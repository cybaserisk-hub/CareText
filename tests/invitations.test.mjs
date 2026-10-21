import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {invitationService,digest,POLICY} from '../src/invitation-service.mjs';
test('recipient test workflow: authorization, expiry, consent, replay, limits and snapshot invalidation',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create role supabase_auth_admin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;`);
 for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
 const sid='00000000-0000-4000-8000-000000000001',rid='00000000-0000-4000-8000-000000000002',rel='00000000-0000-4000-8000-000000000003';
 await db.exec(`insert into auth.users values('${sid}');insert into public.profiles(id)values('${sid}');insert into public.recipients(id,sender_id,display_name,phone)values('${rid}','${sid}','Test recipient','+12025550123');insert into public.relationships(id,sender_id,recipient_id,kind)values('${rel}','${sid}','${rid}','Friend');insert into public.onboarding_states(id,sender_id,relationship_id,state)values(gen_random_uuid(),'${sid}','${rel}','{"mode":"care","frequency":"Weekly","days":["Mon"]}');`);
 let code;
 const service=invitationService({rpc:async(action,data)=>{await db.exec('set role service_role');return (await db.query('select public.recipient_invitation_test($1,$2::jsonb) as result',[action,JSON.stringify(data)])).rows[0].result;},authenticate:async bearer=>bearer==='owner'?{id:sid,email:'sender@example.invalid',email_confirmed_at:'yes'}:null,onTestCode:r=>{code=r.code;}});
 const call=(action,token,extra={})=>service({action,token,...extra});
 const create=async()=>new URL('http://localhost'+(await service({action:'create',relationship_id:rel},'owner')).path).hash.slice(7);
 await assert.rejects(service({action:'create',relationship_id:rel}),/sign-in/);
 await assert.rejects(service({action:'create',relationship_id:'00000000-0000-4000-8000-000000000009'},'owner'),/Save a CareTouch/);
 let token=await create();assert.equal((await call('view',token)).sender,'sender@example.invalid');
 await assert.rejects(call('view','a'.repeat(64)),/unavailable/);
 await assert.rejects(call('challenge',token,{phone:'+12025550999'}),/does not match/);
 const challenge=await call('challenge',token,{phone:'+12025550123'});assert.equal(challenge.code,undefined);
 await assert.rejects(call('verify',token,{code,affirmative:false,policy_version:POLICY}),/Affirmative/);
 await assert.rejects(call('verify',token,{code,affirmative:true,policy_version:'old'}),/Affirmative/);
 const success=await call('verify',token,{code,affirmative:true,policy_version:POLICY});assert.equal(success.status,'accepted_test');assert.equal(success.live_consent,false);
 await assert.rejects(call('verify',token,{code,affirmative:true,policy_version:POLICY}),/already completed/);
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from public.consent_events')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from public.relationships where caretouch_active')).rows[0].n,0);
 const evidence=(await db.query('select * from private.recipient_consent_test_events')).rows[0];assert.equal(evidence.phone,'+12025550123');assert.equal(evidence.live_consent,false);assert.equal(evidence.policy_version,POLICY);assert.match(evidence.disclosure,/STOP/);
 await service({action:'revoke',token},'owner');
 token=await create();await call('decline',token);await assert.rejects(call('challenge',token,{phone:'+12025550123'}),/completed/);
 token=await create();await call('challenge',token,{phone:'+12025550123'});await assert.rejects(call('challenge',token,{phone:'+12025550123'}),/limit/);
 for(let n=0;n<5;n++)await assert.rejects(call('verify',token,{code:'000000',affirmative:true,policy_version:POLICY}),/Incorrect/);
 await assert.rejects(call('verify',token,{code,affirmative:true,policy_version:POLICY}),/locked/);
 token=await create();await db.exec('reset role');await db.query("update private.recipient_invitations set expires_at=now()-interval '1 second' where token_hash=$1",[digest(token)]);await assert.rejects(call('view',token),/expired/);
 token=await create();await db.exec('reset role');await db.exec(`update public.onboarding_states set state=state||'{"frequency":"Daily"}'::jsonb`);await assert.rejects(call('view',token),/Setup changed/);
 token=await create();await call('challenge',token,{phone:'+12025550123'});await db.exec('reset role');await db.query("update private.recipient_invitations set challenge_expires_at=now()-interval '1 second' where token_hash=$1",[digest(token)]);await assert.rejects(call('verify',token,{code,affirmative:true,policy_version:POLICY}),/expired/);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query("select public.recipient_invitation_test('view','{}')"),/permission denied/);await assert.rejects(db.query('select * from private.recipient_consent_test_events'),/permission denied/);}
 }finally{await db.close();}
});
