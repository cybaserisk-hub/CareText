const el=id=>document.getElementById(id);
const token=new URLSearchParams(location.hash.slice(1)).get('token');
let policy, busy=false;
const status=text=>{el('invite-status').textContent=text;};
async function api(action,extra={}){
 const response=await fetch('/api/invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token,...extra})});
 const data=await response.json();if(!response.ok||data.error)throw new Error(data.error||'Invitation unavailable');return data;
}
async function run(task){if(busy)return;busy=true;for(const b of document.querySelectorAll('button'))b.disabled=true;try{await task();}catch(e){status(e.message);}finally{busy=false;for(const b of document.querySelectorAll('button'))b.disabled=false;}}
function completed(message){el('consent-form').hidden=true;status(message);}
el('request-code').addEventListener('click',()=>run(async()=>{await api('challenge',{phone:el('invite-phone').value.trim(),verification_requested:true});status('Test code generated in the private server terminal. No SMS was sent. Ask the test operator for the code.');}));
el('consent-form').addEventListener('submit',event=>{event.preventDefault();run(async()=>{if(!el('sms-consent').checked)throw new Error('Separate SMS consent is required');await api('verify',{code:el('invite-code').value,affirmative:true,policy_version:policy});completed('Test acceptance recorded. Phone ownership is NOT verified for live SMS. No messages will be sent.');});});
el('decline-invitation').addEventListener('click',()=>run(async()=>{await api('decline');completed('Invitation declined. No SMS consent was granted.');}));
if(!token)status('No invitation token is attached. Ask the subscriber for a valid invitation.');
else run(async()=>{const data=await api('view');policy=data.policy_version;el('invite-sender').textContent=data.sender;el('invite-frequency').textContent=data.frequency;el('invite-phone-hint').textContent=data.phone_hint;el('invite-disclosure').textContent=data.disclosure;el('invite-details').hidden=false;if(data.status!=='pending')completed('Invitation status: '+data.status+'. No live SMS is authorized.');else status('Review the subscriber, schedule and disclosure before making a choice.');});
