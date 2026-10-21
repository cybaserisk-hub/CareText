import {createClient} from '@supabase/supabase-js';
const panel=document.getElementById('invitation-tools');
if(['localhost','127.0.0.1'].includes(location.hostname) && window.CARETEXT_CONFIG?.url && window.CARETEXT_CONFIG?.key){
 panel.hidden=false;const client=createClient(window.CARETEXT_CONFIG.url,window.CARETEXT_CONFIG.key);let token;
 const status=document.getElementById('invitation-tools-status');
 async function api(action,data){const {data:{session}}=await client.auth.getSession();const response=await fetch('/api/invitations',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(session?.access_token||'')},body:JSON.stringify({action,...data})});const result=await response.json();if(!response.ok||result.error)throw new Error(result.error);return result;}
 document.getElementById('create-invitation').onclick=async()=>{
  const button=document.getElementById('create-invitation');button.disabled=true;
  try{const setup=new URL(location.href).searchParams.get('setup');if(!setup)throw new Error('Save setup first.');const r=await client.from('onboarding_states').select('relationship_id').eq('id',setup).single();if(r.error)throw r.error;
   const result=await api('create',{relationship_id:r.data.relationship_id});const link=document.getElementById('test-invitation-link');link.href=result.path;link.textContent='Open private recipient invitation';link.hidden=false;token=new URL(result.path,location.origin).hash.slice(7);document.getElementById('revoke-invitation').disabled=false;status.textContent='Test invitation created for the SAVED setup. Expires in 24 hours. Copying this localhost link works only on this computer. No invitation was sent.';
  }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
 };
 document.getElementById('revoke-invitation').onclick=async()=>{try{await api('revoke',{token});status.textContent='Invitation revoked.';}catch(e){status.textContent=e.message;}};
}
