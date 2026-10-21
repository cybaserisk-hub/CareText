import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';import {Window} from 'happy-dom';
import {createAutopilotReadinessService,createAutopilotPreparationEndpoint} from '../src/autopilot-server.mjs';
import {mountAutopilotPanel} from '../src/autopilot-panel.js';
test('authoritative readiness rejects other senders, keeps activation off and records pause/notices atomically',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create role supabase_auth_admin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;`);
 for(const f of (await readdir('supabase/migrations')).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
 const sender='00000000-0000-4000-8000-000000000001',recipient='00000000-0000-4000-8000-000000000002',relationship='00000000-0000-4000-8000-000000000003';
 await db.exec(`insert into auth.users values('${sender}');insert into public.profiles(id)values('${sender}');insert into public.recipients(id,sender_id,display_name)values('${recipient}','${sender}','Synthetic');insert into public.relationships(id,sender_id,recipient_id,kind)values('${relationship}','${sender}','${recipient}','Friend');`);
 for(const role of ['anon','authenticated'])assert.equal((await db.query(`select has_function_privilege('${role}','public.autopilot_readiness(text,jsonb)','EXECUTE') ok`)).rows[0].ok,false);
 const user={id:sender,email_confirmed_at:'2026-01-01',created_at:'2026-01-01'};
 const admin={auth:{getUser:async token=>token==='valid'?{data:{user}}:{error:true},admin:{getUserById:async()=>({data:{user}})}},rpc:async(name,args)=>{await db.exec('set role service_role');return {data:(await db.query('select public.autopilot_readiness($1,$2) result',[args.action,args.data])).rows[0].result};}};
 const service=createAutopilotReadinessService(admin);
 await assert.rejects(service('invalid',{action:'status',relationship_id:relationship}));
 const status=await service('valid',{action:'status',relationship_id:relationship,sender_id:'forged',completed_batches:999});assert.equal(status.completedBatches,0);assert.equal(status.consentEligible,false);assert.equal(status.activationAllowed,false);
 const paused=await service('valid',{action:'paused',relationship_id:relationship});assert.equal(paused.mode,'paused');assert.equal(paused.pendingNotices,2);
 await assert.rejects(service('valid',{action:'autopilot',relationship_id:relationship}));
 await assert.rejects(service('valid',{action:'status',relationship_id:recipient}));
 await db.exec('reset role');
 for(const permission of ['UPDATE','DELETE','TRUNCATE'])assert.equal((await db.query(`select has_table_privilege('service_role','private.autopilot_completed_batches','${permission}') ok`)).rows[0].ok,false);
 await assert.rejects(db.query('insert into private.autopilot_completed_batches(sender_id,approval_ids,completion_evidence) values($1,$2,$3)',[sender,[recipient],'synthetic-invalid-proof']));
 const draft=(await db.query('insert into public.message_drafts(sender_id,relationship_id,content) values($1,$2,$3) returning id',[sender,relationship,'Synthetic approved message'])).rows[0].id;
 const approval=(await db.query('insert into public.message_approvals(sender_id,draft_id,approved_content) values($1,$2,$3) returning id',[sender,draft,'Synthetic approved message'])).rows[0].id;
 await db.query('insert into private.autopilot_completed_batches(sender_id,approval_ids,completion_evidence) values($1,$2,$3)',[sender,[approval],'synthetic-outcome-reference']);
 await assert.rejects(db.query('insert into private.autopilot_completed_batches(sender_id,approval_ids,completion_evidence) values($1,$2,$3)',[sender,[approval],'synthetic-duplicate-outcome']));
 assert.equal((await service('valid',{action:'status',relationship_id:relationship})).completedBatches,1);
 assert.equal((await createAutopilotPreparationEndpoint()(new Request('http://localhost/api/autopilot'))).status,503);
 }finally{await db.close();}
});
test('subscriber controls never expose activation; unavailable backend stays disabled',async()=>{
 const window=new Window(),root=window.document.createElement('div');
 const panel=mountAutopilotPanel(root);assert.equal(panel.querySelector('input').checked,false);assert.equal(panel.querySelector('input').disabled,true);assert.ok([...panel.querySelectorAll('button')].every(b=>b.disabled));
 let saved;const wired=mountAutopilotPanel(root,{change:async mode=>{saved=mode;}});wired.querySelectorAll('button')[2].click();await new Promise(r=>setTimeout(r,0));assert.equal(saved,'paused');assert.match(wired.textContent,/confirmation queued/);window.happyDOM.abort();
});
