import twilio from 'twilio';

// This build deliberately has no production transport. Even real credentials or
// environment flags cannot enable network delivery through this factory.
export function createTwilioVerify({accountSid, serviceSid, transport, mode='disabled'}) {
 if(mode!=='local-test' || !transport || transport.localOnly!==true)throw new Error('Live verification is disabled');
 if(!/^AC[a-f0-9]{32}$/i.test(accountSid)||!/^VA[a-f0-9]{32}$/i.test(serviceSid))throw new Error('Invalid Verify configuration');
 const client=twilio(accountSid,'local-test-not-a-credential',{httpClient:transport,autoRetry:false});
 const service=client.verify.v2.services(serviceSid);
 const validate=(r,phone)=>{
  if(r.accountSid!==accountSid||r.serviceSid!==serviceSid||r.to!==phone||!/^VE[a-f0-9]{32}$/i.test(r.sid))throw new Error('Verification context mismatch');
  return r;
 };
 return {
  async start(phone){
   const r=validate(await service.verifications.create({to:phone,channel:'sms'}),phone);
   if(r.status!=='pending')throw new Error('Verification unavailable');
   return {sid:r.sid};
  },
  async check({sid,phone,code}){
   const r=validate(await service.verificationChecks.create({verificationSid:sid,code}),phone);
   if(r.sid!==sid)throw new Error('Verification context mismatch');
   return r.status==='approved' && r.valid===true;
  }
 };
}
