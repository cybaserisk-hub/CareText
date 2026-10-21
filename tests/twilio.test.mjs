import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import twilio from 'twilio';
import {createTwilioVerify} from '../src/twilio-verify.mjs';
import {twilioInvitationService} from '../src/twilio-invitations.mjs';
import {createTwilioWebhookHandler} from '../src/twilio-webhooks.mjs';
import {POLICY,digest} from '../src/invitation-service.mjs';
const accountSid='AC'+'1'.repeat(32),serviceSid='VA'+'2'.repeat(32),mg='MG'+'3'.repeat(32),ve='VE'+'4'.repeat(32);
const number='+12025550100',phone='+12025550123',authToken='synthetic-local-signature-secret';
const urls={inbound:'https://caretext.app/api/twilio/inbound',status:'https://caretext.app/api/twilio/status'};

test('Twilio local contract: SDK Verify, consent, signed webhooks, suppression and RLS',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create role supabase_auth_admin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;`);
 for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
 const sid='00000000-0000-4000-8000-000000000001',rid='00000000-0000-4000-8000-000000000002',rel='00000000-0000-4000-8000-000000000003';
 await db.exec(`insert into auth.users values('${sid}');insert into public.profiles(id)values('${sid}');insert into public.recipients(id,sender_id,display_name,phone)values('${rid}','${sid}','Test','${phone}');insert into public.relationships(id,sender_id,recipient_id,kind)values('${rel}','${sid}','${rid}','Friend');insert into public.onboarding_states(id,sender_id,relationship_id,state)values(gen_random_uuid(),'${sid}','${rel}','{"mode":"care","frequency":"Weekly","days":["Mon"]}');`);
 const rpcFor=name=>async(action,data)=>{await db.exec('set role service_role');return (await db.query(`select public.${name}($1,$2::jsonb) result`,[action,JSON.stringify(data)])).rows[0].result;};
 const rpc=rpcFor('twilio_local_test');let requests=0,providerError=false,wrongPhone=false;
 const transport={localOnly:true,async request(opts){
  requests++;
  assert.equal(opts.method,'post');assert.match(opts.uri,new RegExp('/Services/'+serviceSid+'/Verification'));
  const checking=opts.uri.endsWith('/VerificationCheck');
  if(checking)assert.equal(opts.data.VerificationSid,ve);else {assert.equal(opts.data.To,phone);assert.equal(opts.data.Channel,'sms');}
  if(providerError)throw new Error('simulated timeout');
  const approved=checking&&opts.data.Code==='123456';
  return {statusCode:200,body:JSON.stringify({sid:ve,account_sid:accountSid,service_sid:serviceSid,to:wrongPhone?'+12025550999':phone,status:approved?'approved':'pending',valid:approved}),headers:{}};
 }};
 assert.throws(()=>createTwilioVerify({accountSid,serviceSid}),/disabled/);
 assert.throws(()=>createTwilioVerify({accountSid,serviceSid,transport,mode:'live'}),/disabled/);
 const provider=createTwilioVerify({accountSid,serviceSid,transport,mode:'local-test'});
 const options={rpc,invitationRpc:rpcFor('recipient_invitation_test'),authenticate:async b=>b==='owner'?{id:sid,email:'owner@example.invalid',email_confirmed_at:'yes'}:null,provider};
 let service=twilioInvitationService(options);
 const create=async()=>new URL('http://localhost'+(await service({action:'create',relationship_id:rel},'owner')).path).hash.slice(7);
 const start=token=>service({action:'challenge',token,phone,verification_requested:true});
 const verify=(token,extra={})=>service({action:'verify',token,code:'123456',affirmative:true,policy_version:POLICY,...extra});
 let token=await create();
 await assert.rejects(service({action:'challenge',token,phone}),/Explicit/);
 await assert.rejects(service({action:'challenge',token,phone:'+12025550999',verification_requested:true}),/match/);assert.equal(requests,0);
 await start(token);await assert.rejects(start(token),/limit/);
 await assert.rejects(verify(token,{affirmative:false}),/Affirmative/);
 await assert.rejects(verify(token,{policy_version:'stale'}),/Affirmative/);
 await assert.rejects(verify(token,{code:'000000'}),/Incorrect/);
 // A fresh application instance uses persisted verification SID/reservation.
 service=twilioInvitationService(options);
 assert.equal((await verify(token)).live_consent,false);
 await assert.rejects(verify(token),/completed/);
 token=await create();await start(token);
 for(let n=0;n<5;n++)await assert.rejects(verify(token,{code:'000000'}),/Incorrect/);
 await assert.rejects(verify(token),/locked/);
 token=await create();providerError=true;await assert.rejects(start(token),/unavailable/);providerError=false;await assert.rejects(verify(token),/first/);
 token=await create();await start(token);wrongPhone=true;await assert.rejects(verify(token),/unavailable/);wrongPhone=false;
 await db.exec('reset role');await db.query("update private.recipient_invitations set challenge_expires_at=now()-interval '1 second' where token_hash=$1",[digest(token)]);await assert.rejects(verify(token),/expired/);
 token=await create();await start(token);
 const handler=createTwilioWebhookHandler({enabled:true,authToken,accountSid,serviceSid:mg,number,urls,rpc});
 let sequence=0;
 const base=()=>({AccountSid:accountSid,MessagingServiceSid:mg,MessageSid:'SM'+String(++sequence).padStart(32,'0'),From:phone,To:number,Body:'hello'});
 const request=(kind,params,overrides={})=>new Request('http://localhost'+new URL(urls[kind]).pathname,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':twilio.getExpectedTwilioSignature(authToken,urls[kind],params),...overrides},body:new URLSearchParams(params)});
 assert.equal((await createTwilioWebhookHandler()(request('inbound',base()))).status,503);
 const bad=base();assert.equal((await handler(request('inbound',bad,{'x-twilio-signature':'wrong'}))).status,403);
 assert.equal((await handler(request('inbound',{...base(),AccountSid:'AC'+'9'.repeat(32)}))).status,403);
 assert.equal((await handler(request('inbound',{...base(),MessagingServiceSid:'MG'+'9'.repeat(32)}))).status,403);
 assert.equal((await handler(request('inbound',{...base(),To:'+12025550999'}))).status,403);
 const tampered=base();const signed=request('inbound',tampered);
 assert.equal((await handler(new Request(signed.url,{method:'POST',headers:signed.headers,body:new URLSearchParams({...tampered,Body:'STOP'})}))).status,403);
 const wrongUrl=request('inbound',base());wrongUrl.headers.set('x-twilio-signature',twilio.getExpectedTwilioSignature(authToken,'https://evil.invalid/api/twilio/inbound',base()));assert.equal((await handler(wrongUrl)).status,403);
 const stop={...base(),Body:' stop ',OptOutType:'STOP',FutureTwilioField:'signed too'};
 await db.exec('reset role');await db.query('insert into private.twilio_test_messages(message_sid,phone) values($1,$2)',['SM'+'a'.repeat(32),phone]);
 let response=await handler(request('inbound',stop));assert.equal(response.status,200);assert.doesNotMatch(await response.text(),/<Message>/);
 await handler(request('inbound',stop));
 for(const keyword of ['HELP','START']){response=await handler(request('inbound',{...base(),Body:keyword,OptOutType:keyword}));assert.equal(response.status,200);assert.doesNotMatch(await response.text(),/<Message>/);}
 await assert.rejects(verify(token),/opted out/);
 await db.exec('reset role');
 assert.match((await db.query("select help_preview from private.twilio_test_events where kind='HELP'")).rows[0].help_preview,/support@caretext.app/);
 assert.equal((await db.query('select suppressed from private.twilio_test_suppression where phone=$1',[phone])).rows[0].suppressed,true);
 assert.equal((await db.query("select count(*)::int n from private.twilio_test_events where kind='STOP'")).rows[0].n,1);
 assert.equal((await db.query('select status from private.twilio_test_messages')).rows[0].status,'canceled');
 assert.equal((await db.query('select count(*)::int n from public.consent_events')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from public.relationships where caretouch_active')).rows[0].n,0);
 assert.equal((await db.query("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname like 'twilio_test_%' and c.relkind='r' and c.relrowsecurity")).rows[0].n,4);
 assert.equal((await db.query("select prosecdef from pg_proc where proname='twilio_local_test'")).rows[0].prosecdef,false);
 const outbound='SM'+'b'.repeat(32);
 await db.query('insert into private.twilio_test_messages(message_sid,phone) values($1,$2)',[outbound,phone]);
 const status=s=>({...base(),MessageSid:outbound,From:number,To:phone,MessageStatus:s});
 assert.equal((await handler(request('status',status('delivered')))).status,200);
 await handler(request('status',status('sent')));await handler(request('status',status('delivered')));
 assert.equal((await handler(request('status',{...status('sent'),MessageSid:'SM'+'c'.repeat(32)}))).status,400);
 await db.exec('reset role');assert.equal((await db.query('select status from private.twilio_test_messages where message_sid=$1',[outbound])).rows[0].status,'delivered');
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query("select public.twilio_local_test('inbound','{}')"),/permission denied/);for(const table of ['twilio_test_verifications','twilio_test_suppression','twilio_test_events','twilio_test_messages'])await assert.rejects(db.query('select * from private.'+table),/permission denied/);}
 }finally{await db.close();}
});
