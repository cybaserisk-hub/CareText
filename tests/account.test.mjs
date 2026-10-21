import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {mountAutopilotPanel} from '../src/autopilot-panel.js';
const html = await readFile('site/account.html','utf8');
const source = (await readFile('src/account.js','utf8')).replace("import { createClient } from '@supabase/supabase-js';",'const createClient = window.mockCreateClient;').replace("import {mountAutopilotPanel} from './autopilot-panel.js';",'const mountAutopilotPanel = window.mountAutopilotPanel;');
const settle = () => new Promise(resolve=>setTimeout(resolve,30));
function setup(config = {}) {
  const window = new Window({url:'https://caretext.example/account.html',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
  window.document.write(html);
  window.CARETEXT_CONFIG = config;
  window.mountAutopilotPanel = mountAutopilotPanel;
  return window;
}
test('unconfigured account fails closed', async()=>{
  const window = setup();
  try {
    window.eval(source);
    assert.match(window.document.querySelector('#status').textContent,/not connected/);
    assert.equal(window.document.querySelector('#auth').hidden,true);
    assert.equal(window.document.querySelector('#account').hidden,true);
  } finally { await window.happyDOM.close(); }
});
test('auth, recovery, relationship creation and sign-out UI',async()=>{
  const window = setup({url:'https://test.supabase.co',key:'sb_publishable_test'});
  let callback,session=null;
  const calls=[];
  const result={data:{},error:null};
  window.mockCreateClient=()=>({
    auth:{
      onAuthStateChange(fn){callback=fn;fn('INITIAL_SESSION',null);},
      async signUp(value){calls.push(['signup',value]);return result;},
      async signInWithPassword(value){calls.push(['signin',value]);session={user:{id:'sender',email:value.email}};callback('SIGNED_IN',session);return result;},
      async resetPasswordForEmail(email,options){calls.push(['reset',email,options]);return result;},
      async updateUser(value){calls.push(['update',value]);return result;},
      async getSession(){return {data:{session},error:null};},
      async signOut(){session=null;callback('SIGNED_OUT',null);return result;}
    },
    from(){return {select(){return {async order(){return {data:[{id:'relationship',kind:'Parent',recipients:{display_name:'<script>bad()</script>'}}],error:null};}};}};},
    async rpc(name,args){calls.push([name,args]);return result;}
  });
  try {
    window.eval(source);await settle();
    const $=selector=>window.document.querySelector(selector);
    const submit=(selector,button)=>$(selector).dispatchEvent(new window.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:button}));
    $('#login input[name=email]').value='test@example.com';
    $('#login input[name=password]').value='test-password-123';
    submit('#login',$('[value=signup]'));await settle();
    assert.equal(calls[0][0],'signup');
    assert.equal(calls[0][1].options.emailRedirectTo,'https://caretext.example/account.html');
    $('#login input[name=email]').value='test@example.com';
    submit('#login',$('[value=reset]'));await settle();
    assert.equal(calls[1][0],'reset');
    $('#login input[name=email]').value='test@example.com';
    $('#login input[name=password]').value='test-password-123';
    submit('#login',$('#login .primarybtn'));await settle();
    assert.equal($('#account').hidden,false);
    assert.equal($('#recipients script'),null);
    assert.match($('#recipients').textContent,/<script>/);
    $('#recipient input[name=name]').value='Mom';
    submit('#recipient',$('#recipient button'));await settle();
    const rpc=calls.find(call=>call[0]==='create_relationship');
    assert.deepEqual(Object.keys(rpc[1]).sort(),['display_name','kind','phone']);
    callback('PASSWORD_RECOVERY',session);await settle();
    assert.equal($('#recovery').hidden,false);
    $('#password input').value='new-password-123';
    submit('#password',$('#password button'));await settle();
    assert.equal($('#recovery').hidden,true);
    $('#logout').click();await settle();
    assert.equal($('#account').hidden,true);
    assert.equal($('#recipients').textContent,'');
    assert.equal($('#identity').textContent,'');
  } finally { await window.happyDOM.close(); }
});
