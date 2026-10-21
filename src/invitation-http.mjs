import {invitationService} from './invitation-service.mjs';
import {createClient} from '@supabase/supabase-js';
export function createInvitationHandler(env=process.env){
 if(env.CARETEXT_INVITATION_TEST_MODE!=='1')return null;
 if(!env.CARETEXT_TEST_ADMIN_KEY)throw new Error('Private invitation test requires a server-only key');
 const admin=createClient(env.SUPABASE_URL,env.CARETEXT_TEST_ADMIN_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const service=invitationService({
  rpc:async(action,data)=>{const r=await admin.rpc('recipient_invitation_test',{action,data});if(r.error)throw new Error(r.error.message);return r.data;},
  authenticate:async token=>{if(!token)throw new Error('Sign-in required');const r=await admin.auth.getUser(token);if(r.error)throw new Error('Sign-in required');return r.data.user;},
  onTestCode:({invitation,code})=>console.log(`LOCAL SIMULATED PHONE CHECK ${invitation}: ${code} (not real phone verification)`)
 });
 const buckets=new Map();
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const fail=(status,error)=>res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify({error}));
  if(req.method!=='POST')return fail(405,'POST required');
  if(!['localhost:4173','127.0.0.1:4173'].includes(req.headers.host)||!['http://localhost:4173','http://127.0.0.1:4173'].includes(req.headers.origin))return fail(403,'Local same-origin request required');
  if(!req.headers['content-type']?.startsWith('application/json'))return fail(415,'JSON required');
  const now=Date.now(),address=req.socket.remoteAddress;
  for(const [k,v] of buckets)if(v.until<now)buckets.delete(k);
  const bucket=buckets.get(address)||{until:now+60000,count:0};buckets.set(address,bucket);
  if(++bucket.count>30)return fail(429,'Request limit reached');
  let raw='';try{
   for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>4096)return fail(413,'Request too large');}
   const result=await service(JSON.parse(raw),req.headers.authorization?.replace(/^Bearer /,''));
   res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(result));
  }catch(error){fail(400,error.message);}
 };
}
