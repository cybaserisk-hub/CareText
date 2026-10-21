import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
test('existing invitation screen switches production copy, requires affirmative consent, supports withdrawal',async()=>{
 const w=new Window({url:'http://localhost/invite#token='+ 'a'.repeat(64),settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
 try{
 w.document.write(await readFile('site/invite/index.html','utf8'));const calls=[];
 w.fetch=async(url,request)=>{const body=JSON.parse(request.body);calls.push(body);return {ok:true,json:async()=>body.action==='view'?{test_only:false,sender:'Subscriber',frequency:'Weekly',phone_hint:'ending in 0123',disclosure:'Disclosure',policy_version:'v1',status:'pending'}:{ok:true,status:'accepted'}};};
 w.eval(await readFile('site/invite/flow.js','utf8'));await new Promise(r=>setTimeout(r,10));
 const el=id=>w.document.getElementById(id);
 assert.equal(el('sms-consent').checked,false);assert.equal(el('request-code').textContent,'Request verification code');
 el('consent-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,10));assert.equal(calls.filter(c=>c.action==='verify').length,0);
 el('sms-consent').checked=true;el('invite-code').value='123456';el('consent-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,10));
 assert.equal(calls.find(c=>c.action==='verify').affirmative,true);assert.equal(el('withdraw-consent').hidden,false);el('withdraw-consent').click();await new Promise(r=>setTimeout(r,10));assert.equal(calls.at(-1).action,'withdraw');assert.match(el('invite-status').textContent,/withdrawn/);
 }finally{await w.happyDOM.close();}
});
