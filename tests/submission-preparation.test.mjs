import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {buildReview} from '../scripts/build-review.mjs';
import {DISCLOSURE} from '../src/invitation-service.mjs';
import {CONSENT_POLICY} from '../src/production-consent.mjs';
test('pending migration preserves existing data, overrides broad default grants and can fail closed',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create role supabase_auth_admin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;`);
 const files=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
 const pending='20261021041742_production_recipient_consent.sql';assert.equal(files.at(-1),pending);
 for(const file of files.slice(0,-1))await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await db.exec(`insert into auth.users values('00000000-0000-4000-8000-000000000001');insert into public.profiles(id,display_name) values('00000000-0000-4000-8000-000000000001','Existing synthetic user');`);
 await db.exec(await readFile('deployment/consent-preflight.sql','utf8'));
 await db.exec(`alter default privileges in schema private grant all on tables to service_role,authenticated,anon;alter default privileges in schema public grant all on tables to service_role,authenticated,anon;`);
 await db.exec(await readFile('supabase/migrations/'+pending,'utf8'));
 assert.equal((await db.query('select display_name from public.profiles')).rows[0].display_name,'Existing synthetic user');
 for(const role of ['anon','authenticated']){
  assert.equal((await db.query(`select has_function_privilege('${role}','public.production_consent(text,jsonb)','EXECUTE') allowed`)).rows[0].allowed,false);
  assert.equal((await db.query(`select has_table_privilege('${role}','private.consent_evidence','SELECT') allowed`)).rows[0].allowed,false);
 }
 for(const permission of ['UPDATE','DELETE','TRUNCATE'])assert.equal((await db.query(`select has_table_privilege('service_role','private.consent_evidence','${permission}') allowed`)).rows[0].allowed,false);
 assert.equal((await db.query("select has_table_privilege('service_role','public.recipient_replies','DELETE') allowed")).rows[0].allowed,false);
 await db.exec("insert into private.recipient_suppression(phone,blocked) values('+12025550123',true)");
 await db.exec(await readFile('deployment/consent-disable.sql','utf8'));
 assert.equal((await db.query('select blocked from private.recipient_suppression')).rows[0].blocked,true);
 assert.equal((await db.query("select has_function_privilege('service_role','public.production_consent(text,jsonb)','EXECUTE') allowed")).rows[0].allowed,false);
 assert.ok((await db.query("select 1 from pg_constraint where conname='relationships_caretouch_emergency_disabled'")).rows.length);
 }finally{await db.close();}
});
test('restricted review artifact excludes account code, endpoints and credentials; exact routes deny everything else',async()=>{
 const scope=await buildReview();assert.deepEqual(scope.approvedConsentEndpoints,[]);
 const walk=async dir=>(await Promise.all((await readdir(dir,{withFileTypes:true})).map(async e=>e.isDirectory()?(await walk(dir+'/'+e.name)).map(f=>e.name+'/'+f):[e.name]))).flat();
 assert.deepEqual((await walk('review-dist')).sort(),[...Object.values(scope.routes),'404.html','_redirects','_headers'].sort());
 const redirects=await readFile('review-dist/_redirects','utf8');
 const route=path=>redirects.trim().split('\n').find(line=>line.split(' ')[0]===path||line.startsWith('/* '));
 for(const path of ['/','/account.html','/app.html','/api/invitations','/api/twilio/inbound','/.netlify/functions/consent','/config.js','/.env','/privacy/index.html'])assert.equal(route(path),'/* /404.html 404!');
 for(const path of Object.keys(scope.routes))assert.ok(route(path).endsWith('200!'));
 const config=await readFile('netlify.toml','utf8');assert.match(config,/publish = "review-dist"/);assert.match(config,/command = "node scripts\/deployment-disabled.mjs"/);assert.match(config,/directory = "deployment\/no-functions"/);
 assert.match(await readFile('review-dist/_headers','utf8'),/Referrer-Policy: no-referrer/);
 assert.match(DISCLOSURE,/subscriber reviews and approves/);assert.match(DISCLOSURE,/under both delivery models/);assert.equal(CONSENT_POLICY,'caretext-sms-consent-v3');
 const terms=await readFile('review-dist/terms/index.html','utf8');assert.match(terms,/first CareText release/);
});
