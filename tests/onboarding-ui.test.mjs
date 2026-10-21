import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
test('text edits persist on input without blur rerenders dropping the last edit',async()=>{
  const window=new Window({url:'http://localhost:4173/app.html',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
  try{
    window.document.write(await readFile('site/app.html','utf8'));
    window.structuredClone=structuredClone;
    let saved;
    window.createOnboardingStore=()=>({load:async()=>({state:{step:3,plan:'Plus'},learn:true,example1:'',example2:'',actualPlan:'Free'}),save:async state=>{saved=state;}});
    const source=(await readFile('site/workspace.js','utf8')).replace(/^import .*\r?\n/,'');
    await window.eval(`(async()=>{${source}\n})()`);
    const input=(selector,value)=>{const e=window.document.querySelector(selector);e.value=value;e.dispatchEvent(new window.Event('input',{bubbles:true}));return e;};
    const limits=input('[data-key=limits]','Do not mention work');
    input('[data-key=example1]','My private example');
    assert.equal(window.document.querySelector('[data-key=limits]'),limits);
    window.document.querySelector('#save-setup').click();
    await new Promise(resolve=>setTimeout(resolve,10));
    assert.equal(saved.limits,'Do not mention work');assert.equal(saved.example1,'My private example');
    assert.match(window.document.querySelector('#save-status').textContent,/saved securely/);
  }finally{await window.happyDOM.close();}
});
