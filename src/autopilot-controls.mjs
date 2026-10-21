// Server-only decision engine. No provider imports, HTTP handlers, environment gates,
// or live send implementation. Inputs must come from the transactional server store.
import {createHash} from 'node:crypto';
export const AUTOPILOT_VERSION='caretext-autopilot-v1';
export const LIVE_AUTOPILOT_ENABLED=false;
const DAY=86400000;
const hash=s=>createHash('sha256').update(s).digest('hex');
const time=s=>typeof s==='string'?Date.parse(s):NaN;
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const checks=['offLimits','platformPolicy','sensitiveInferences','fabricatedEvents','inappropriateClaims','repetition','promptInjection','contextIsolation'];
export function smsSegments(text){
 if(typeof text!=='string'||!text.length||text.length>480)throw new Error('Invalid message');
 const basic="@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
 const extension='^{}\\[~]|€\f';let units=0;
 for(const c of text){if(basic.includes(c))units++;else if(extension.includes(c))units+=2;else return Math.ceil(text.length/(text.length<=70?70:67));}
 return Math.ceil(units/(units<=160?160:153));
}
export function localSlot(now,timezone){
 if(!Number.isFinite(now)||typeof timezone!=='string'||!timezone)return null;
 try{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(now).map(x=>[x.type,x.value]));return {date:`${p.year}-${p.month}-${p.day}`,hour:Number(p.hour),weekday:p.weekday};}catch{return null;}
}
export function eligibility(s,now,{autopilot=true}={}){
 const reasons=[];const deny=(condition,reason)=>{if(!condition)reasons.push(reason);};
 deny(Number.isFinite(now),'clock');
 deny(s?.security===true&&s?.auditHealthy===true&&s?.providerHealthy===true&&!s?.incident,'security_or_provider');
 deny(s?.globalPaused===false&&s?.accountPaused===false,'paused');
 deny(s?.subscription?.status==='active'&&['Essential','Plus'].includes(s?.subscription?.plan),'subscription');
 const c=s?.consent;
 deny(c?.status==='granted'&&c?.verified===true&&c?.providerEvidence===true&&c?.suppressed===false&&c?.senderId===s?.senderId&&c?.recipientId===s?.recipientId&&c?.relationshipId===s?.relationshipId&&c?.phoneHash===s?.phoneHash&&c?.scheduleRevision===s?.schedule?.revision&& (autopilot?c?.version==='caretext-sms-consent-v3':['caretext-sms-consent-v2','caretext-sms-consent-v3'].includes(c?.version)),'consent');
 const limit=s?.subscription?.plan==='Plus'?5:1;
 deny(integer(s?.activeRecipients)&&s.activeRecipients>0&&s.activeRecipients<=limit&&s.replacementAllowed===true,'recipient_limits');
 deny(s?.preferences?.fresh===true&&s.preferences.revision===s?.reviewedRevision&&s.preferences.samplesReviewed===true,'preferences');
 deny(localSlot(now,s?.schedule?.timezone)!==null&&['Weekly','Daily'].includes(s?.schedule?.frequency)&& (s?.schedule?.frequency!=='Daily'||s?.subscription?.plan==='Plus')&&Array.isArray(s?.schedule?.days)&&s.schedule.days.length>0&&s.schedule.days.every(d=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].includes(d)),'schedule');
 const period=s?.period;
 deny(time(period?.start)<=now&&now<time(period?.end)&&integer(period?.used)&&integer(period?.reserved),'billing_period');
 if(autopilot){
  const created=time(s?.authCreatedAt);
  deny(s?.authSource==='supabase_auth'&&Number.isFinite(created)&&created<=now&&now-created>=90*DAY,'account_age');
  const batches=Array.isArray(s?.batches)?s.batches:[];
  deny(new Set(batches.filter(b=>b.senderId===s.senderId&&b.humanApproved===true&&b.completed===true&&b.auditId&&b.id&&time(b.completedAt)<=now&&time(b.completedAt)>=created).map(b=>b.id)).size>=2,'human_batches');
 }
 return {eligible:reasons.length===0,reasons};
}
export function validateSafety(text,attestation,s,now){
 return typeof text==='string'&&text.length>0&&text.length<=480&&attestation?.contentHash===hash(text)&&attestation?.relationshipId===s.relationshipId&&attestation?.revision===s.preferences.revision&&attestation?.policy===AUTOPILOT_VERSION&&time(attestation?.checkedAt)<=now&&now-time(attestation?.checkedAt)<=300000&&checks.every(k=>attestation?.checks?.[k]==='pass')&&!!attestation?.auditId;
}
export function contentHash(text){return hash(text);}
export const SAFETY_CHECKS=Object.freeze(checks);
// transaction must serialize by sender across BOTH delivery models, roll back errors,
// load fresh authoritative records, and commit state + audit + notices together.
// The only executable transport is a local simulator, deliberately created here.
export function createAutopilotDevelopmentService({transaction,authenticate,clock=Date.now}){
 if(typeof transaction!=='function'||typeof authenticate!=='function')throw new Error('Server dependencies required');
 const run=async(relationshipId,fn)=>transaction(relationshipId,async s=>{
  if(!s||s.relationshipId!==relationshipId)throw new Error('Relationship unavailable');
  s.jobs??=[];s.events??=[];s.notices??=[];s.mode??='manual';
  return fn(s,clock());
 });
 const record=(s,now,type,actor)=>{if(s.auditHealthy!==true)throw new Error('Audit unavailable');s.events.push({id:s.events.length+1,type,actor,at:new Date(now).toISOString(),revision:s.preferences?.revision});};
 const cancel=s=>{for(const j of s.jobs)if(j.status==='reserved'){j.status='cancelled';s.period.reserved-=j.segments;}};
 const suspend=(s,now,reason)=>{s.mode='suspended';s.reason=reason;cancel(s);record(s,now,'suspended','system');};
 const notify=(s,now)=>{for(const channel of ['in_app','email'])s.notices.push({channel,status:'pending',mode:s.mode,at:new Date(now).toISOString(),recipient:'subscriber'});};
 return {
  async changeMode(bearer,relationshipId,{mode,affirmative=false,version,revision}={}){
   const user=await authenticate(bearer);if(!user?.id||!user.email_confirmed_at)throw new Error('Verified sign-in required');
   return run(relationshipId,(s,now)=>{
    if(user.id!==s.senderId)throw new Error('Unauthorized');
    if(!['manual','paused','autopilot'].includes(mode))throw new Error('Invalid mode');
    if(mode==='autopilot'){
     const e=eligibility(s,now);
     if(!e.eligible||affirmative!==true||version!==AUTOPILOT_VERSION||revision!==s.preferences.revision||s.mode==='autopilot')throw new Error('Explicit current eligible opt-in required');
     s.optIn={actor:user.id,at:new Date(now).toISOString(),version,revision};
    }
    cancel(s);s.mode=mode;s.reason=null;record(s,now,'mode_'+mode,user.id);notify(s,now);
    return {mode,developmentOnly:true,liveEnabled:false};
   });
  },
  async reconcile(relationshipId){return run(relationshipId,(s,now)=>{const e=eligibility(s,now);if(s.mode==='autopilot'&&!e.eligible)suspend(s,now,e.reasons.join(','));return e;});},
  async reserve(relationshipId,{id,text,attestation,scheduledAt,model='trusted_autopilot',approval}={}){
   return run(relationshipId,(s,now)=>{
    if(!['trusted_autopilot','human_approved'].includes(model)||typeof id!=='string'||!id||id.length>100)throw new Error('Invalid reservation');
    const old=s.jobs.find(j=>j.id===id);if(old){if(old.hash!==hash(text)||old.model!==model)throw new Error('Idempotency conflict');return {...old};}
    const auto=model==='trusted_autopilot';const e=eligibility(s,now,{autopilot:auto});
    if(['paused','suspended'].includes(s.mode))return {rejected:true,reasons:['paused']};
    if(!e.eligible){if(s.mode==='autopilot')suspend(s,now,e.reasons.join(','));return {rejected:true,reasons:e.reasons};}
    if(auto&&(s.mode!=='autopilot'||s.optIn?.version!==AUTOPILOT_VERSION||s.optIn?.revision!==s.preferences.revision))throw new Error('Mode not authorized');
    if(!auto&&(!approval?.id||approval.senderId!==s.senderId||approval.contentHash!==hash(text)||time(approval.at)>now||!Number.isFinite(time(approval.at))))throw new Error('Immutable human approval required');
    if(!validateSafety(text,attestation,s,now)){suspend(s,now,'safety');return {rejected:true,reasons:['safety']};}
    const slot=localSlot(now,s.schedule.timezone),due=time(scheduledAt);
    // A scheduled slot has a 60s processing window, never an outage catch-up queue.
    if(!Number.isFinite(due)||due>now||now-due>=60000||slot.hour<8||slot.hour>=21||!s.schedule.days.includes(slot.weekday))return {rejected:true,reasons:['missed_or_quiet_slot']};
    if(s.jobs.some(j=>j.localDate===slot.date&&j.status!=='cancelled'))return {rejected:true,reasons:['daily_limit']};
    const segments=smsSegments(text),cap=s.subscription.plan==='Plus'?100:15;
    if(s.period.used+s.period.reserved+segments>cap)return {rejected:true,reasons:['quota']};
    const job={id,model,hash:hash(text),segments,status:'reserved',localDate:slot.date,scheduledAt,revision:s.preferences.revision,periodStart:s.period.start,attestation,approval};
    s.period.reserved+=segments;s.jobs.push(job);record(s,now,'reserved','system');return {...job};
   });
  },
  async simulateSubmission(relationshipId,id,text){return run(relationshipId,(s,now)=>{
   const j=s.jobs.find(x=>x.id===id);if(!j||j.status!=='reserved')throw new Error('Not dispatchable');
   const e=eligibility(s,now,{autopilot:j.model==='trusted_autopilot'}),slot=localSlot(now,s.schedule.timezone);
   if(!e.eligible||['paused','suspended'].includes(s.mode)||j.revision!==s.preferences.revision||j.hash!==hash(text)||!validateSafety(text,j.attestation,s,now)||s.period.start!==j.periodStart||now-time(j.scheduledAt)>=60000||now<time(j.scheduledAt)||slot?.hour<8||slot?.hour>=21||(j.model==='trusted_autopilot'&&s.mode!=='autopilot')){suspend(s,now,'final_gate');return {rejected:true};}
   // No network transport exists. Durable reservation remains consumed for unknown results.
   record(s,now,'simulated_submission','system');j.status='simulated';s.period.reserved-=j.segments;s.period.used+=j.segments;
   return {simulated:true,liveEnabled:false};
  });},
  async incident(relationshipId,reason){
   if(!['safety','consent','payment','provider','preferences','audit','global_pause','account_pause'].includes(reason))throw new Error('Invalid reason');
   return run(relationshipId,(s,now)=>{s.incident=reason;suspend(s,now,reason);return {suspended:true};});
  },
  async liveSubmit(){throw new Error('Live Autopilot and SMS delivery are disabled');}
 };
}
