import {createServer} from 'node:http';
import {randomBytes,randomInt} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {createTwilioVerify} from '../src/twilio-verify.mjs';
import {twilioInvitationService} from '../src/twilio-invitations.mjs';
import {createTwilioWebhookHandler} from '../src/twilio-webhooks.mjs';

if(!process.argv.includes('--local-test'))throw new Error('Explicit --local-test required');
// Synthetic data only. No .env, Supabase credentials, Twilio credentials, or network transport.
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create role supabase_auth_admin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;`);
for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
const sender='00000000-0000-4000-8000-000000000001',recipient='00000000-0000-4000-8000-000000000002',relationship='00000000-0000-4000-8000-000000000003';
const phone='+12025550123',number='+12025550100',accountSid='AC'+'1'.repeat(32),serviceSid='VA'+'2'.repeat(32),mg='MG'+'3'.repeat(32);
await db.exec(`insert into auth.users values('${sender}');insert into public.profiles(id)values('${sender}');insert into public.recipients(id,sender_id,display_name,phone)values('${recipient}','${sender}','Synthetic recipient','${phone}');insert into public.relationships(id,sender_id,recipient_id,kind)values('${relationship}','${sender}','${recipient}','Friend');insert into public.onboarding_states(id,sender_id,relationship_id,state)values(gen_random_uuid(),'${sender}','${relationship}','{"mode":"care","frequency":"Weekly","days":["Mon"]}');set role service_role;`);
const rpcFor=name=>async(action,data)=>(await db.query(`select public.${name}($1,$2::jsonb) result`,[action,JSON.stringify(data)])).rows[0].result;
const rpc=rpcFor('twilio_local_test');
const challenges=new Map();
const transport={localOnly:true,async request(options){
 const checking=options.uri.endsWith('/VerificationCheck');
 let c;
 if(!checking){
  c={sid:'VE'+randomBytes(16).toString('hex'),code:String(randomInt(100000,1000000)),until:Date.now()+300000};challenges.set(c.sid,c);
  console.log('SIMULATED CODE (no SMS): '+c.code);
 }else c=challenges.get(options.data.VerificationSid);
 if(!c||Date.now()>c.until)throw new Error('Expired');
 const approved=checking&&options.data.Code===c.code;
 return {statusCode:200,headers:{},body:JSON.stringify({sid:c.sid,account_sid:accountSid,service_sid:serviceSid,to:phone,status:approved?'approved':'pending',valid:approved})};
}};
const service=twilioInvitationService({rpc,invitationRpc:rpcFor('recipient_invitation_test'),authenticate:async()=>({id:sender,email:'synthetic-subscriber@example.invalid',email_confirmed_at:'yes'}),provider:createTwilioVerify({accountSid,serviceSid,transport,mode:'local-test'})});
const invitation=await service({action:'create',relationship_id:relationship});
const urls={inbound:'https://caretext.app/api/twilio/inbound',status:'https://caretext.app/api/twilio/status'};
const webhook=createTwilioWebhookHandler({enabled:true,authToken:'synthetic-local-signature-secret',accountSid,serviceSid:mg,number,urls,rpc});
const root=resolve('dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{
 const reply=(status,body,type='application/json')=>res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'}).end(body);
 try {
  if(!['localhost:4174','127.0.0.1:4174'].includes(req.headers.host))return reply(403,'{}');
  const url=new URL(req.url,'http://localhost:4174');
  if(url.pathname.startsWith('/api/')){
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16384)return reply(413,'{}');}
   if(url.pathname==='/api/invitations'){
    if(req.method!=='POST'||!['http://localhost:4174','http://127.0.0.1:4174'].includes(req.headers.origin))return reply(403,'{}');
    const body=JSON.parse(raw);
    if(!['view','challenge','verify','decline'].includes(body.action))return reply(403,'{}');
    try{return reply(200,JSON.stringify(await service(body)));}catch(e){return reply(400,JSON.stringify({error:e.message}));}
   }
   const result=await webhook(new Request(url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:raw}:{})}));
   return reply(result.status,await result.text(),result.headers.get('content-type'));
  }
  const route=['/privacy','/terms','/invite'].includes(url.pathname)?url.pathname+'/index.html':url.pathname;
  const path=resolve(root,'.'+decodeURIComponent(route));if(!path.startsWith(root+sep))return reply(403,'{}');
  return reply(200,await readFile(path),types[extname(path)]||'application/octet-stream');
 }catch{return reply(404,'{}');}
});
server.listen(4174,'127.0.0.1',()=>console.log(`LOCAL TWILIO SIMULATION ONLY\nInvited synthetic number: ${phone}\nhttp://localhost:4174${invitation.path}`));
process.on('SIGINT',()=>server.close(async()=>{await db.close();process.exit(0);}));
