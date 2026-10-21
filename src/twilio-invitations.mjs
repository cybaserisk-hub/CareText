import {randomBytes} from 'node:crypto';
import {digest,invitationService} from './invitation-service.mjs';

// RPC is server-only; callers cannot supply phone/SID/approval evidence at commit.
export function twilioInvitationService({rpc,invitationRpc,authenticate,provider}) {
 const call=async(action,data)=>{const r=await rpc(action,data);if(r.error)throw new Error(r.error);return r;};
 const original=invitationService({rpc:invitationRpc,authenticate,onTestCode:()=>{throw new Error('Wrong verification mode');}});
 return async(body,bearer)=>{
  if(!['challenge','verify'].includes(body?.action))return original(body,bearer);
  if(typeof body.token!=='string'||! /^[a-f0-9]{64}$/.test(body.token))throw new Error('Invitation unavailable');
  const data={token_hash:digest(body.token)};
  if(body.action==='challenge'){
   if(body.verification_requested!==true)throw new Error('Explicit verification request required');
   if(typeof body.phone!=='string'||!/^\+[1-9][0-9]{7,14}$/.test(body.phone))throw new Error('Invalid phone');
   const reservation=randomBytes(32).toString('hex');
   const r=await call('reserve',{...data,phone:body.phone,reservation});
   try {
    const result=await provider.start(r.phone);
    await call('attach',{...data,reservation,verification_sid:result.sid});
   }catch {throw new Error('Verification unavailable; wait before retrying');}
   return {ok:true,test_only:true};
  }
  if(typeof body.code!=='string'||!/^\d{6}$/.test(body.code))throw new Error('Enter a six-digit code');
  const r=await call('check',{...data,affirmative:body.affirmative===true,policy_version:body.policy_version});
  let approved=false;
  try {approved=await provider.check({sid:r.verification_sid,phone:r.phone,code:body.code});}
  catch {throw new Error('Verification unavailable; request a new code if expired');}
  if(!approved)throw new Error('Incorrect or expired verification code');
  return call('accept',{...data,reservation:r.reservation,verification_sid:r.verification_sid,affirmative:true,policy_version:body.policy_version});
 };
}
