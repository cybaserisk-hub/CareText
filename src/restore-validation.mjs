// Offline validation model, NOT a production deletion worker. A restore cannot be
// released on the strength of this simulation; all provider copies need evidence.
export function quarantineRestoredDevelopmentState(snapshot,{deletions,suppressions,sourceVerified}={}){
 if(sourceVerified!==true||!Array.isArray(deletions)||!Array.isArray(suppressions))throw new Error('Independent recovery evidence required');
 const restored=structuredClone(snapshot);
 for(const [id,s] of Object.entries(restored.relationships||{})){
  if(deletions.includes(s.senderId)||deletions.includes(s.recipientId)){delete restored.relationships[id];continue;}
  s.mode='suspended';s.reason='restore_quarantine';s.incident='restore_quarantine';s.jobs=[];s.globalPaused=true;
  if(suppressions.includes(s.phoneHash))s.consent={...s.consent,status:'withdrawn',suppressed:true};
 }
 // Existing consumption is not refunded; unknown reservations remain charged.
 return {state:restored,releaseAllowed:false};
}
