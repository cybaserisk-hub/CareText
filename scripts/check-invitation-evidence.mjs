import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const f=JSON.parse(await readFile('test-results/browser-fixture.json','utf8'));
if(!/^caretext-browser-[0-9a-f-]+@example.invalid$/.test(f.email)||! /^[0-9a-f-]{36}$/.test(f.id))throw new Error('Disposable fixture required');
const cleanup=process.argv[2]==='cleanup';
const sql=cleanup?`begin;delete from private.recipient_consent_test_events where sender_id='${f.id}';delete from private.recipient_invitations where sender_id='${f.id}';commit;`:`select (select jsonb_agg(jsonb_build_object('action',action,'live_consent',live_consent,'method',verification_method)) from private.recipient_consent_test_events where sender_id='${f.id}') as test_events,(select count(*) from public.consent_events where sender_id='${f.id}') as live_events,(select count(*) from public.relationships where sender_id='${f.id}' and caretouch_active) as active_relationships`;
console.log(execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','db','query','--linked','--project-ref','ixpniaronwgjimqyeowq',sql],{env:{...process.env,NODE_USE_SYSTEM_CA:'1'},encoding:'utf8'}));
