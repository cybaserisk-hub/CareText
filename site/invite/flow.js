const el=id=>document.getElementById(id);
const token=new URLSearchParams(location.hash.slice(1)).get('token');
let policy, busy=false, testOnly=true;
const status=text=>{el('invite-status').textContent=text;};
async function api(action,extra={}){
 const response=await fetch('/api/invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token,...extra})});
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Invitation verification is not available. No consent was recorded. Contact support@caretext.app.');
 const data=await response.json();if(!response.ok||data.error)throw new Error(data.error||'Invitation unavailable');return data;
}
async function run(task){if(busy)return;busy=true;for(const b of document.querySelectorAll('button'))b.disabled=true;try{await task();}catch(e){status(e.message);}finally{busy=false;for(const b of document.querySelectorAll('button'))b.disabled=false;}}
function completed(message){el('consent-form').hidden=true;status(message);}
el('request-code').addEventListener('click',()=>run(async()=>{await api('challenge',{phone:el('invite-phone').value.trim(),verification_requested:true});status(testOnly?'Test code generated in the private server terminal. No SMS was sent. Ask the test operator for the code.':'Verification requested. Enter the code sent to your phone.');}));
el('consent-form').addEventListener('submit',event=>{event.preventDefault();run(async()=>{if(!el('sms-consent').checked)throw new Error('Separate SMS consent is required');await api('verify',{code:el('invite-code').value,affirmative:true,policy_version:policy});completed(testOnly?'Test acceptance recorded. Phone ownership is NOT verified for live SMS. No messages will be sent.':'Consent recorded. Message delivery remains disabled.');el('withdraw-consent').hidden=testOnly;});});
el('decline-invitation').addEventListener('click',()=>run(async()=>{await api('decline');completed('Invitation declined. No SMS consent was granted.');}));
if(!token)status('No invitation token is attached. Ask the subscriber for a valid invitation.');
else run(async()=>{const data=await api('view');policy=data.policy_version;testOnly=data.test_only!==false;if(!testOnly){el('invite-notice').textContent='Verify your phone and separately consent before CareTouch can be activated. Message delivery remains disabled.';el('invite-mode-note').textContent='Trusted Autopilot and message delivery remain disabled.';el('request-code').textContent='Request verification code';el('accept-invitation').textContent='Accept & Verify';el('withdraw-consent').hidden=data.status!=='accepted';}el('invite-sender').textContent=data.sender;el('invite-frequency').textContent=data.frequency;el('invite-phone-hint').textContent=data.phone_hint;el('invite-disclosure').textContent=data.disclosure;el('invite-details').hidden=false;if(data.status!=='pending')completed('Invitation status: '+data.status+'. Message delivery remains disabled.');else status('Review the subscriber, schedule and disclosure before making a choice.');});

el('withdraw-consent').addEventListener('click',()=>run(async()=>{await api('withdraw');el('withdraw-consent').hidden=true;completed('SMS consent withdrawn. No further CareTouch messages are authorized.');}));
