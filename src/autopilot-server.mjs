import {loadAuthAccountClock} from './autopilot-auth-clock.mjs';
// Unmounted preparation API. Status comes from DB and Auth Admin, never browser facts.
export function createAutopilotReadinessService(admin){
 return async(bearer,{action,relationship_id}={})=>{
  if(!['status','manual','paused'].includes(action))throw new Error('Autopilot activation disabled');
  if(typeof relationship_id!=='string'||! /^[0-9a-f-]{36}$/i.test(relationship_id))throw new Error('Invalid relationship');
  const auth=await admin.auth.getUser(bearer);const user=auth?.data?.user;
  if(auth?.error||!user?.id||!user.email_confirmed_at)throw new Error('Verified sign-in required');
  const clock=await loadAuthAccountClock(admin,user.id);
  const response=await admin.rpc('autopilot_readiness',{action,data:{sender_id:user.id,relationship_id}});
  const r=response?.data;if(response?.error||r?.sender_id!==user.id||r?.relationship_id!==relationship_id)throw new Error('Readiness unavailable');
  const age=(Date.now()-Date.parse(clock.authCreatedAt))/86400000;
  return {mode:r.mode,accountAgeEligible:age>=90,completedBatches:r.completed_batches,consentEligible:r.consent_eligible===true&&r.consent_version==='caretext-sms-consent-v3',subscriptionEligible:r.subscription_status==='active'&&['Essential','Plus'].includes(r.plan),pendingNotices:r.pending_notices,liveEnabled:false,activationAllowed:false};
 };
}
export function createAutopilotPreparationEndpoint({admin,origin,enabled=false}={}){
 if(!enabled)return async()=>new Response('Autopilot endpoint disabled',{status:503});
 const service=createAutopilotReadinessService(admin);
 return async request=>{
  const url=new URL(request.url);
  if(url.pathname!=='/api/autopilot'||url.search||request.method!=='POST'||request.headers.get('origin')!==origin||request.headers.get('content-type')?.split(';')[0]!=='application/json')return new Response('Invalid request',{status:403});
  try{
   let size=0;const chunks=[];if(!request.body)throw new Error();const reader=request.body.getReader();
   while(true){const x=await reader.read();if(x.done)break;size+=x.value.length;if(size>2048){await reader.cancel();return new Response('Too large',{status:413});}chunks.push(x.value);}
   const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   const result=await service(request.headers.get('authorization')?.replace(/^Bearer /,''),body);
   return Response.json(result,{headers:{'cache-control':'no-store'}});
  }catch{return new Response('Request unavailable',{status:400});}
 };
}
