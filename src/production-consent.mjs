import {randomBytes,createHmac} from 'node:crypto';
import {digest,DISCLOSURE} from './invitation-service.mjs';
import {createTwilioWebhookHandler} from './twilio-webhooks.mjs';
export const CONSENT_POLICY='caretext-sms-consent-v2';
// Constructed only by a trusted server. No credentials, SDK or flags enter the bundle.
export function productionConsentService({rpc,authenticate,verifyService,accountSid,serviceSid,verificationEnabled=false}){
 const call=async(action,data)=>{const r=await rpc(action,data);if(r.error)throw new Error(r.error);return r;};
 const validate=(r,phone,sid)=>{if(r.accountSid!==accountSid||r.serviceSid!==serviceSid||r.to!==phone||!/^VE[a-f0-9]{32}$/i.test(r.sid)||(sid&&r.sid!==sid))throw new Error('Verification context mismatch');};
 return async(body,bearer)=>{
  if(!body||typeof body!=='object')throw new Error('Invalid request');
  if(body.action==='create'){
   const user=await authenticate(bearer);if(!user?.id||!user.email_confirmed_at)throw new Error('Verified sign-in required');
   const token=randomBytes(32).toString('hex');
   const r=await call('create',{sender_id:user.id,relationship_id:body.relationship_id,token_hash:digest(token),policy_version:CONSENT_POLICY,disclosure:DISCLOSURE});
   return {...r,path:'/invite#token='+token,test_only:false};
  }
  if(typeof body.token!=='string'||! /^[a-f0-9]{64}$/.test(body.token))throw new Error('Invitation unavailable');
  const data={token_hash:digest(body.token)};
  if(body.action==='revoke'){const user=await authenticate(bearer);if(!user?.id)throw new Error('Sign-in required');return call('revoke',{...data,sender_id:user.id});}
  if(['view','decline','withdraw'].includes(body.action))return call(body.action,data);
  if(!['challenge','verify'].includes(body.action))throw new Error('Unsupported action');
  if(!verificationEnabled||!verifyService)throw new Error('Paid verification is disabled');
  if(body.action==='challenge'){
   if(body.verification_requested!==true||!/^\+[1-9][0-9]{7,14}$/.test(body.phone||''))throw new Error('Explicit phone verification request required');
   const reservation=randomBytes(32).toString('hex');
   const r=await call('reserve',{...data,phone:body.phone,reservation});
   let p;try{p=await verifyService.verifications.create({to:r.phone,channel:'sms',locale:'en'});validate(p,r.phone);if(p.status!=='pending')throw new Error();}catch{throw new Error('Verification unavailable; wait before retrying');}
   await call('attach',{...data,reservation,verification_sid:p.sid,service_sid:serviceSid,account_sid:accountSid});
   return {ok:true,test_only:false};
  }
  if(!/^\d{6}$/.test(body.code||''))throw new Error('Six-digit code required');
  // No client-supplied SID, phone, timestamp, sender, or approval status is trusted.
  const r=await call('check',{...data,affirmative:body.affirmative===true,policy_version:body.policy_version});
  let p;try{p=await verifyService.verificationChecks.create({verificationSid:r.verification_sid,code:body.code});validate(p,r.phone,r.verification_sid);}catch{throw new Error('Verification unavailable or expired');}
  if(p.status!=='approved'||p.valid!==true)throw new Error('Incorrect or expired verification code');
  return call('accept',{...data,reservation:r.reservation,verification_sid:p.sid,provider_status:'approved',affirmative:true,policy_version:body.policy_version});
 };
}
export function createProductionConsentEndpoints({admin,verifyService,config={},enabled=false,verificationEnabled=false}={}){
 if(!enabled)return async()=>new Response('Consent endpoints disabled',{status:503});
 if(!config.rateSecret||!config.origin)throw new Error('Server configuration required');
 const rpc=async(action,data)=>{const r=await admin.rpc('production_consent',{action,data});if(r.error)throw new Error('Persistence unavailable');return r.data;};
 const service=productionConsentService({rpc,authenticate:async bearer=>{if(!bearer)return null;const r=await admin.auth.getUser(bearer);return r.error?null:r.data.user;},verifyService,accountSid:config.accountSid,serviceSid:config.verifyServiceSid,verificationEnabled});
 const webhook=createTwilioWebhookHandler({enabled:true,authToken:config.authToken,accountSid:config.accountSid,serviceSid:config.messagingServiceSid,number:config.number,urls:config.urls,rpc});
 return async(request,{clientIp}={})=>{
  const path=new URL(request.url).pathname;
  if(path==='/api/twilio/inbound'||path==='/api/twilio/status')return webhook(request);
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
  if(path!=='/api/invitations')return reply(404,{});
  if(request.method!=='POST'||new URL(request.url).search||request.headers.get('origin')!==config.origin)return reply(403,{error:'Same-origin POST required'});
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json'||!clientIp)return reply(400,{error:'Invalid request'});
  try{
   const limit=await rpc('rate',{key:createHmac('sha256',config.rateSecret).update(clientIp).digest('hex')});if(limit.error)return reply(429,{error:'Request limit reached'});
   let bytes=0;const chunks=[];if(!request.body)return reply(400,{});const reader=request.body.getReader();
   while(true){const r=await reader.read();if(r.done)break;bytes+=r.value.length;if(bytes>4096){await reader.cancel();return reply(413,{});}chunks.push(r.value);}
   const result=await service(JSON.parse(Buffer.concat(chunks).toString('utf8')),request.headers.get('authorization')?.replace(/^Bearer /,''));return reply(200,result);
  }catch{return reply(400,{error:'Request could not be completed; review invitation, consent and verification status'});}
 };
}
// Future dispatchers must use this gate immediately before dispatch. There is no sender.
export async function requireDeliveryEligibility(rpc,relationshipId){
 const r=await rpc('eligibility',{relationship_id:relationshipId});
 if(r.error||!r.consent_eligible||r.delivery_allowed!==true)throw new Error('CareTouch delivery disabled or consent ineligible');
 return r;
}

// Deployment host supplies server-only clients; never imports the controlled-test vault.
export function createProductionConsentRuntime({admin,twilioClient,config,enabled=false,verificationEnabled=false}={}){
 if(!enabled)return createProductionConsentEndpoints();
 if(config.verifyServiceSid!=='VAb58e188f4d73b88dbfe818c76c7f8387')throw new Error('Dedicated CareText Verify service required');
 return createProductionConsentEndpoints({admin,config,enabled,verificationEnabled,verifyService:twilioClient.verify.v2.services(config.verifyServiceSid)});
}
