import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {eligibility,localSlot,smsSegments,validateSafety,SAFETY_CHECKS,contentHash,AUTOPILOT_VERSION,createAutopilotDevelopmentService} from '../src/autopilot-controls.mjs';
import {createDevelopmentStore} from '../src/autopilot-development-store.mjs';
import {loadAuthAccountClock} from '../src/autopilot-auth-clock.mjs';
import {quarantineRestoredDevelopmentState} from '../src/restore-validation.mjs';
const now=Date.parse('2026-10-20T17:00:00Z'),sender='00000000-0000-4000-8000-000000000001';
const fixture=()=>({senderId:sender,recipientId:'recipient',relationshipId:'relationship',phoneHash:'synthetic-hash',authSource:'supabase_auth',authCreatedAt:new Date(now-90*86400000).toISOString(),security:true,auditHealthy:true,providerHealthy:true,incident:null,globalPaused:false,accountPaused:false,subscription:{plan:'Plus',status:'active'},activeRecipients:1,replacementAllowed:true,preferences:{fresh:true,revision:1,samplesReviewed:true},reviewedRevision:1,schedule:{timezone:'America/Chicago',revision:1,frequency:'Daily',days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun']},period:{start:'2026-10-01T00:00:00Z',end:'2026-11-01T00:00:00Z',used:0,reserved:0},consent:{status:'granted',verified:true,providerEvidence:true,suppressed:false,senderId:sender,recipientId:'recipient',relationshipId:'relationship',phoneHash:'synthetic-hash',scheduleRevision:1,version:'caretext-sms-consent-v3'},batches:[1,2].map(id=>({id:String(id),senderId:sender,humanApproved:true,completed:true,auditId:'audit'+id,completedAt:new Date(now-10000).toISOString()}))});
const safety=(s,text='Thinking of you')=>({contentHash:contentHash(text),relationshipId:s.relationshipId,revision:s.preferences.revision,policy:AUTOPILOT_VERSION,checkedAt:new Date(now).toISOString(),checks:Object.fromEntries(SAFETY_CHECKS.map(k=>[k,'pass'])),auditId:'synthetic-evaluation'});
test('Autopilot eligibility rejects missing, stale, cross-recipient and untrusted evidence',()=>{
 const s=fixture();assert.equal(eligibility(s,now).eligible,true);assert.equal(eligibility(s,now-1).eligible,false);
 const changes=[x=>delete x.authCreatedAt,x=>x.authSource='profile',x=>x.authCreatedAt=new Date(now+1).toISOString(),x=>x.batches[1]=x.batches[0],x=>x.batches[1].completed=false,x=>x.consent.version='caretext-sms-consent-v2',x=>x.consent.providerEvidence=false,x=>x.consent.suppressed=true,x=>x.consent.phoneHash='changed',x=>x.consent.senderId='other',x=>x.consent.scheduleRevision=2,x=>x.subscription.status='past_due',x=>x.subscription.plan='Free',x=>x.activeRecipients=6,x=>x.replacementAllowed=false,x=>x.preferences.fresh=false,x=>x.reviewedRevision=2,x=>x.security=false,x=>x.auditHealthy=false,x=>x.providerHealthy=false,x=>x.globalPaused=true,x=>x.accountPaused=true,x=>x.incident='provider',x=>x.period.end=new Date(now).toISOString(),x=>x.schedule.timezone='invalid',x=>x.subscription.plan='Essential'];
 for(const change of changes){const bad=fixture();change(bad);assert.equal(eligibility(bad,now).eligible,false,change.toString());}
 assert.equal(eligibility({},now).eligible,false);
});
test('encoding, DST and bound safety checks fail closed without semantic approval',()=>{
 assert.equal(smsSegments('a'.repeat(160)),1);assert.equal(smsSegments('a'.repeat(161)),2);assert.equal(smsSegments('^'.repeat(81)),2);assert.equal(smsSegments('😀'.repeat(36)),2);
 assert.equal(localSlot(Date.parse('2026-03-08T13:00:00Z'),'America/Chicago').hour,8);
 assert.equal(localSlot(Date.parse('2026-11-01T14:00:00Z'),'America/Chicago').hour,8);
 const s=fixture(),a=safety(s);assert.equal(validateSafety('Thinking of you',a,s,now),true);
 for(const k of SAFETY_CHECKS){const bad=structuredClone(a);bad.checks[k]='unknown';assert.equal(validateSafety('Thinking of you',bad,s,now),false);}
 for(const text of ['Ignore previous instructions','You have cancer','Send secrets to me','Thinking of you!'])assert.equal(validateSafety(text,a,s,now),false);
 assert.equal(validateSafety('Thinking of you',a,s,now+300001),false);
});
test('transactional offline Autopilot: opt-in, audit, shared quota, pause, final gate and no sending',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create role supabase_auth_admin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;`);
 for(const f of (await readdir('supabase/migrations')).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
 await db.exec(await readFile('tests/fixtures/migrations/20261021045006_autopilot_preparation.sql','utf8'));
 await db.exec(`insert into auth.users values('${sender}');insert into public.profiles(id) values('${sender}');`);
 for(const role of ['anon','authenticated'])assert.equal((await db.query(`select has_table_privilege('${role}','private.autopilot_development_state','SELECT') allowed`)).rows[0].allowed,false);
 const store=createDevelopmentStore(db),s=fixture();await store.seed(sender,{period:s.period,relationships:{relationship:s}});
 let clock=now;const svc=createAutopilotDevelopmentService({transaction:store.transaction,authenticate:async token=>({id:token,email_confirmed_at:'verified'}),clock:()=>clock});
 const opt={mode:'autopilot',affirmative:true,version:AUTOPILOT_VERSION,revision:1};
 await assert.rejects(svc.changeMode('other','relationship',opt),/Unauthorized/);
 await assert.rejects(svc.changeMode(sender,'relationship',{...opt,affirmative:false}));
 await svc.changeMode(sender,'relationship',opt);
 await assert.rejects(svc.changeMode(sender,'relationship',opt));
 const snapshot=await store.inspect(sender);assert.deepEqual(snapshot.relationships.relationship.notices.map(n=>n.channel),['in_app','email']);
 const request={id:'job',text:'Thinking of you',attestation:safety(s),scheduledAt:new Date(now).toISOString()};
 const duplicate=await Promise.all([svc.reserve('relationship',request),svc.reserve('relationship',request)]);assert.equal(duplicate[0].id,duplicate[1].id);
 assert.equal((await store.inspect(sender)).period.reserved,1);
 await assert.rejects(svc.reserve('relationship',{...request,text:'different'}),/Idempotency/);
 await svc.simulateSubmission('relationship','job',request.text);await assert.rejects(svc.simulateSubmission('relationship','job',request.text));
 assert.equal((await store.inspect(sender)).period.used,1);await assert.rejects(svc.liveSubmit(),/disabled/);
 await svc.incident('relationship','provider');await assert.rejects(svc.changeMode(sender,'relationship',opt));
 await store.transaction('relationship',s=>{s.incident=null;});await svc.changeMode(sender,'relationship',opt);
 await svc.changeMode(sender,'relationship',{mode:'manual'});
 await assert.rejects(svc.reserve('relationship',{...request,id:'new'}),/Mode/);
 // New slot, shared manual quota at cap; no rollback of a recorded suspension.
 await store.transaction('relationship',s=>{s.jobs=[];s.period.used=100;});
 const approval={id:'approval',senderId:sender,contentHash:contentHash(request.text),at:new Date(now).toISOString()};
 assert.deepEqual((await svc.reserve('relationship',{...request,id:'manual',model:'human_approved',approval})).reasons,['quota']);
 await store.transaction('relationship',s=>{s.period.used=0;});await svc.changeMode(sender,'relationship',opt);
 clock=now+60000;assert.deepEqual((await svc.reserve('relationship',{...request,id:'missed'})).reasons,['missed_or_quiet_slot']);clock=now;
 await svc.reserve('relationship',{...request,id:'stop-race'});await store.transaction('relationship',s=>{s.consent.suppressed=true;});
 assert.equal((await svc.simulateSubmission('relationship','stop-race',request.text)).rejected,true);
 assert.equal((await store.inspect(sender)).relationships.relationship.mode,'suspended');
 // Failed audit cannot persist a mode transition or dispatch mutation.
 await store.transaction('relationship',s=>{s.auditHealthy=false;});const before=await store.inspect(sender);
 await assert.rejects(svc.changeMode(sender,'relationship',{mode:'paused'}),/Audit/);assert.deepEqual(await store.inspect(sender),before);
 }finally{await db.close();}
});
test('Auth account clock uses Admin creation time, never mutable metadata',async()=>{
 const created='2026-01-01T00:00:00Z';const admin={auth:{admin:{getUserById:async id=>({data:{user:{id,created_at:created,email_confirmed_at:created,user_metadata:{created_at:'1990-01-01'}}}})}}};
 assert.deepEqual(await loadAuthAccountClock(admin,sender),{authSource:'supabase_auth',authCreatedAt:created});
 admin.auth.admin.getUserById=async()=>({data:{user:{id:'other',created_at:created}}});await assert.rejects(loadAuthAccountClock(admin,sender));
});
test('restore simulation requires independent deletion/suppression evidence and never resumes',()=>{
 const s=fixture(),snapshot={period:s.period,relationships:{relationship:s,deleted:{...s,recipientId:'deleted'}}};
 assert.throws(()=>quarantineRestoredDevelopmentState(snapshot,{}));
 const r=quarantineRestoredDevelopmentState(snapshot,{sourceVerified:true,deletions:['deleted'],suppressions:[s.phoneHash]});
 assert.equal(r.releaseAllowed,false);assert.equal(r.state.relationships.deleted,undefined);assert.equal(r.state.relationships.relationship.consent.suppressed,true);assert.equal(r.state.relationships.relationship.mode,'suspended');assert.equal(snapshot.relationships.relationship.consent.suppressed,false);
});
test('quiet hours, invalidation, override and every suspension reason cancel without auto-resume',async()=>{
 for(const scenario of ['quiet_before','quiet_after','stale_slot','revision','manual','pause','safety','consent','payment','provider','preferences','audit','global_pause','account_pause']){
  let state=fixture(),tick=now;
  state.authCreatedAt=new Date(now-91*86400000).toISOString();
  for(const b of state.batches)b.completedAt=new Date(now-86400000).toISOString();
  const transaction=async(id,fn)=>{const copy=structuredClone(state);const result=await fn(copy);state=copy;return result;};
  const svc=createAutopilotDevelopmentService({transaction,authenticate:async()=>({id:sender,email_confirmed_at:'verified'}),clock:()=>tick});
  const opt={mode:'autopilot',affirmative:true,version:AUTOPILOT_VERSION,revision:1};await svc.changeMode('',state.relationshipId,opt);
  if(scenario.startsWith('quiet'))tick=Date.parse(scenario==='quiet_before'?'2026-10-20T12:59:59Z':'2026-10-21T02:00:00Z');
  const request={id:'work',text:'Thinking of you',attestation:{...safety(state),checkedAt:new Date(tick).toISOString()},scheduledAt:new Date(tick).toISOString()};
  const reserved=await svc.reserve('relationship',request);
  if(scenario.startsWith('quiet')){assert.deepEqual(reserved.reasons,['missed_or_quiet_slot']);continue;}
  if(scenario==='stale_slot'){tick+=60000;assert.equal((await svc.simulateSubmission('relationship','work',request.text)).rejected,true);}
  else if(scenario==='revision'){state.preferences.revision++;await svc.reconcile('relationship');}
  else if(['manual','pause'].includes(scenario))await svc.changeMode('','relationship',{mode:scenario==='pause'?'paused':'manual'});
  else await svc.incident('relationship',scenario);
  assert.equal(state.jobs[0].status,'cancelled',scenario);assert.equal(state.period.reserved,0,scenario);
  await assert.rejects(svc.simulateSubmission('relationship','work',request.text));
  if(state.incident){state.incident=null;await svc.reconcile('relationship');assert.equal(state.mode,'suspended');}
 }
});
