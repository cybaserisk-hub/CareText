import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {Window} from 'happy-dom';
import {CONSENT_POLICY,consentCoversModel,requireDeliveryEligibility} from '../src/production-consent.mjs';
import {DISCLOSURE} from '../src/invitation-service.mjs';
test('production-only migration path; versioned scope and expired withdrawal cannot expand or restore consent',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create role supabase_auth_admin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;`);
 // Prove production has no dependency on the private Twilio contract-test migration.
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&!f.includes('twilio_local_workflow')).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 const u='00000000-0000-4000-8000-000000000001',r='00000000-0000-4000-8000-000000000002',rel='00000000-0000-4000-8000-000000000003';
 await db.exec(`insert into auth.users values('${u}');insert into public.profiles(id,display_name) values('${u}','Synthetic');insert into public.subscriptions(sender_id,plan,status) values('${u}','Plus','active');insert into public.recipients(id,sender_id,display_name,phone) values('${r}','${u}','Synthetic','+12025550123');insert into public.relationships(id,sender_id,recipient_id,kind) values('${rel}','${u}','${r}','Friend');insert into public.onboarding_states(id,sender_id,relationship_id,state) values(gen_random_uuid(),'${u}','${rel}','{"mode":"care","frequency":"Weekly"}');`);
 const rpc=async(action,data)=>{await db.exec('set role service_role');return (await db.query('select public.production_consent($1,$2::jsonb) result',[action,JSON.stringify(data)])).rows[0].result;};
 const admin=async(sql)=>{await db.exec('reset role');return db.exec(sql);};
 const grant=async(key,version,disclosure)=>{
  assert.ok(!(await rpc('create',{sender_id:u,relationship_id:rel,token_hash:key,policy_version:version,disclosure})).error);
  assert.ok(!(await rpc('reserve',{token_hash:key,phone:'+12025550123',reservation:key})).error);
  const sid='VE'+key.slice(0,32);
  await rpc('attach',{token_hash:key,reservation:key,verification_sid:sid,service_sid:'VA'+'b'.repeat(32),account_sid:'AC'+'c'.repeat(32)});
  // Synthetic provider attestation only; no external request.
  const result=await rpc('accept',{token_hash:key,reservation:key,verification_sid:sid,provider_status:'approved',affirmative:true,policy_version:version});assert.equal(result.status,'accepted');
 };
 const old='1'.repeat(64),current='2'.repeat(64),pending='3'.repeat(64);
 await grant(old,'caretext-sms-consent-v2','Historic standard-only disclosure');
 assert.equal(consentCoversModel('caretext-sms-consent-v2','trusted_autopilot'),false);
 await admin("update private.consent_invitations set last_sent_at=now()-interval '2 hours'");
 await grant(current,CONSENT_POLICY,DISCLOSURE);
 await admin("update private.consent_invitations set expires_at=now()-interval '1 day'");
 let view=await rpc('view',{token_hash:current});assert.equal(view.status,'accepted');assert.equal(view.can_withdraw,true);assert.equal(view.withdrawal_only,true);assert.equal(view.policy_version,CONSENT_POLICY);
 assert.equal((await rpc('view',{token_hash:old})).can_withdraw,false);
 await rpc('withdraw',{token_hash:old});assert.equal((await rpc('eligibility',{relationship_id:rel})).consent_eligible,true);
 for(const action of ['reserve','check','accept'])assert.match((await rpc(action,{token_hash:current})).error,/expired/);
 await rpc('withdraw',{token_hash:current});await rpc('withdraw',{token_hash:current});
 assert.equal((await rpc('eligibility',{relationship_id:rel})).consent_eligible,false);
 assert.equal((await rpc('view',{token_hash:current})).can_withdraw,false);
 await admin('select 1');const evidence=(await db.query("select policy_version,disclosure from private.consent_evidence where event='granted' order by policy_version")).rows;
 assert.equal(evidence.length,2);assert.equal(evidence[0].disclosure,'Historic standard-only disclosure');assert.equal(evidence[1].disclosure,DISCLOSURE);
 assert.equal(consentCoversModel(CONSENT_POLICY,'trusted_autopilot'),true);assert.equal(consentCoversModel('unknown','trusted_autopilot'),false);
 await assert.rejects(requireDeliveryEligibility(async()=>({consent_eligible:true,delivery_allowed:true,policy_version:'caretext-sms-consent-v2'}),rel,'trusted_autopilot'),/disabled/);
 await assert.rejects(requireDeliveryEligibility(async()=>({consent_eligible:true,delivery_allowed:false,policy_version:CONSENT_POLICY}),rel,'trusted_autopilot'),/disabled/);
 await rpc('create',{sender_id:u,relationship_id:rel,token_hash:pending,policy_version:CONSENT_POLICY,disclosure:DISCLOSURE});await admin("update private.consent_invitations set expires_at=now()-interval '1 day'");
 view=await rpc('view',{token_hash:pending});assert.equal(view.status,'expired');assert.equal(view.can_withdraw,false);assert.ok((await rpc('view',{token_hash:'4'.repeat(64)})).error);
 }finally{await db.close();}
});
test('expired accepted invitation renders withdrawal only; success hides control without requesting a code',async()=>{
 const w=new Window({url:'http://localhost/invite#token='+'a'.repeat(64),settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
 try{w.document.write(await readFile('site/invite/index.html','utf8'));const actions=[];
 w.fetch=async(url,req)=>{const b=JSON.parse(req.body);actions.push(b.action);return {ok:true,headers:new Headers({'content-type':'application/json'}),json:async()=>b.action==='view'?{test_only:false,status:'accepted',withdrawal_only:true,can_withdraw:true,policy_version:CONSENT_POLICY,disclosure:DISCLOSURE,sender:'Synthetic',frequency:'Weekly'}:{ok:true,status:'withdrawn'}};};
 w.eval(await readFile('site/invite/flow.js','utf8'));await new Promise(r=>setTimeout(r,10));
 assert.equal(w.document.getElementById('consent-form').hidden,true);assert.equal(w.document.getElementById('withdraw-consent').hidden,false);
 w.document.getElementById('withdraw-consent').click();await new Promise(r=>setTimeout(r,10));assert.deepEqual(actions,['view','withdraw']);assert.equal(w.document.getElementById('withdraw-consent').hidden,true);
 }finally{await w.happyDOM.close();}
});
