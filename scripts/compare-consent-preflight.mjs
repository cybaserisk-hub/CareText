// Compare a read-only CLI catalog export with the five confirmed hosted migrations.
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const hosted=JSON.parse(await readFile('test-results/hosted-preflight.json','utf8')).rows[0].preflight;
const db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create role supabase_auth_admin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;`);
 const files=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort().slice(0,5);
 for(const f of files)await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
 const result=await db.exec(await readFile('deployment/consent-preflight.sql','utf8'));
 const local=result.find(r=>r.rows?.[0]?.preflight).rows[0].preflight;
 const canonical=x=>JSON.stringify(x,Object.keys(x).sort());
 const compare=key=>local[key].filter(row=>!hosted[key].some(h=>canonical(h)===canonical(row)));
 const differences=Object.fromEntries(['tables','columns','constraints','policies','column_grants','triggers','plans'].map(k=>[k,compare(k)]));
 // Require minimum grants, but report extra grants separately; they can weaken immutability.
 differences.missing_table_grants=compare('table_grants');
 const names=new Set(local.tables.map(t=>t.schema_name+'.'+t.relname));
 const extraGrants=hosted.table_grants.filter(h=>names.has(h.table_schema+'.'+h.table_name)&&!local.table_grants.some(r=>canonical(h)===canonical(r)));
 const functions=local.functions.map(f=>({name:f.nspname+'.'+f.proname,compatible:hosted.functions.some(h=>h.nspname===f.nspname&&h.proname===f.proname&&h.arguments===f.arguments&&h.prosecdef===f.prosecdef&&JSON.stringify(h.proconfig)===JSON.stringify(f.proconfig))}));
 const report={source:'read-only hosted catalog compared with local PostgreSQL replay',hostedBaseline:files,comparisonDifferences:differences,extraTableGrants:extraGrants,functions,activeRelationships:hosted.active_relationships,pendingObjects:hosted.pending_objects,database:hosted.database,limits:'Catalog comparison only; hosted migration, PostgREST behavior, backup restore and provider callbacks remain untested.'};
 await mkdir('docs',{recursive:true});await writeFile('docs/consent-compatibility.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({differences:Object.fromEntries(Object.entries(differences).map(([k,v])=>[k,v.length])),extraGrants:extraGrants.length,functionMismatches:functions.filter(f=>!f.compatible),active:hosted.active_relationships,pending:hosted.pending_objects}));
}finally{await db.close();}
