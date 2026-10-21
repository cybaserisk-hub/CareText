import {randomBytes,randomInt,createHash,createHmac} from 'node:crypto';
export const POLICY='caretext-recipient-test-v1';
export const DISCLOSURE='I agree to receive recurring CareText SMS from CyBase Risk Management, LLC on behalf of the subscriber identified in this invitation, at the disclosed frequency. Messages may be AI-generated, human-approved, or automatically delivered under Trusted Autopilot when eligible and enabled. Message and data rates may apply. Reply STOP to opt out or HELP for assistance. Consent is not a condition of purchase. Support: support@caretext.app. Privacy: /privacy. Terms: /terms.';
export const digest=value=>createHash('sha256').update(value).digest('hex');
export function invitationService({rpc,authenticate,onTestCode,secret=randomBytes(32)}) {
 const call=async(action,data)=>{const result=await rpc(action,data);if(result.error)throw new Error(result.error);return result;};
 const codeHash=(token,code)=>createHmac('sha256',secret).update(token+':'+code).digest('hex');
 return async (body,bearer)=>{
  if(!body || typeof body!=='object')throw new Error('Invalid request');
  const {action,token}=body;
  if(action==='create'){
   const user=await authenticate(bearer);
   if(!user?.id || !user.email_confirmed_at)throw new Error('Verified sign-in required');
   const token=randomBytes(32).toString('hex');
   const result=await call('create',{sender_id:user.id,sender_name:user.email,relationship_id:body.relationship_id,token_hash:digest(token),disclosure:DISCLOSURE,policy_version:POLICY});
   return {...result,path:'/invite#token='+token,test_only:true};
  }
  if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token))throw new Error('Invitation unavailable');
  const data={token_hash:digest(token)};
  if(action==='revoke'){
   const user=await authenticate(bearer);if(!user?.id)throw new Error('Sign-in required');
   return call('revoke',{...data,sender_id:user.id});
  }
  if(action==='challenge'){
   if(typeof body.phone!=='string'||!/^\+[1-9][0-9]{7,14}$/.test(body.phone))throw new Error('Enter the invited number in international format');
   const code=String(randomInt(100000,1000000));
   const result=await call('challenge',{...data,phone:body.phone,challenge_hash:codeHash(token,code)});
   // Test operator only. Never returned in a browser/API response and never sent to SMS.
   onTestCode({invitation:digest(token).slice(0,12),code});return result;
  }
  if(action==='verify'){
   if(typeof body.code!=='string'||!/^\d{6}$/.test(body.code))throw new Error('Enter a six-digit code');
   return call('verify',{...data,challenge_hash:codeHash(token,body.code),affirmative:body.affirmative===true,policy_version:body.policy_version});
  }
  if(!['view','decline'].includes(action))throw new Error('Unsupported action');
  return call(action,data);
 };
}
