import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {controlledVerify,initializeLedger} from '../src/controlled-verify.mjs';
test('controlled OTP: persistent quotas, exact destination, concurrency, cooldown, expiry and replay',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'caretext-verify-'));const path=join(dir,'ledger.sqlite');initializeLedger(path);
 const config={phone:'+12025550123',accountSid:'AC'+'1'.repeat(32),serviceSid:'VA'+'2'.repeat(32)};
 const approvedHash=createHash('sha256').update(config.phone).digest('hex');let clock=1000000,calls=0,checks=0,providerFail=false;
 const result=()=>({accountSid:config.accountSid,serviceSid:config.serviceSid,to:config.phone,sid:'VE'+'3'.repeat(32)});
 const service={verifications:{async create(p){calls++;assert.equal(p.to,config.phone);assert.equal(p.channel,'sms');if(providerFail)throw new Error('secret should not escape');return {...result(),status:'pending'};}},verificationChecks:{async create(p){checks++;if(p.code==='999999')throw Object.assign(new Error('expired'),{status:404});return {...result(),status:p.code==='123456'?'approved':'pending',valid:p.code==='123456'};}}};
 const opts={path,config,service,now:()=>clock,approvedHash};let adapter=controlledVerify(opts);
 try{
 assert.throws(()=>controlledVerify({...opts,config:{...config,phone:'+12025550999'}}),/not approved/);
 const competing=await Promise.allSettled([adapter.send(),adapter.send()]);assert.equal(competing.filter(r=>r.status==='fulfilled').length,1);assert.equal(calls,1);
 await assert.rejects(adapter.send(),/cooldown/);assert.equal(calls,1);
 assert.equal((await adapter.check(1,'000000')).status,'incorrect');await assert.rejects(adapter.check(1,'123456'),/cooldown/);assert.equal(checks,1);
 clock+=2100;assert.equal((await adapter.check(1,'123456')).status,'approved');await assert.rejects(adapter.check(1,'123456'),/completed/);assert.equal(checks,2);
 adapter.close();adapter=controlledVerify(opts);assert.equal(adapter.snapshot().sends,1);
 for(let n=2;n<=5;n++){clock+=610000;await adapter.send();clock+=610000;assert.equal((await adapter.check(n,'999999',{expiryProbe:true})).status,'expired');}
 assert.equal(adapter.snapshot().reservedCents,500);await assert.rejects(adapter.send(),/limit/);assert.equal(calls,5);
 adapter.close();adapter=controlledVerify(opts);await assert.rejects(adapter.send(),/limit/);assert.equal(calls,5);
 adapter.stop();await assert.rejects(adapter.send(),/stopped/);
 }finally{adapter.close();await rm(dir,{recursive:true,force:true});}
});
test('uncertain sends consume budget and stop further provider calls',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'caretext-uncertain-'));const path=join(dir,'ledger.sqlite');initializeLedger(path);let calls=0;
 const phone='+12025550123';const a=controlledVerify({path,config:{phone},approvedHash:createHash('sha256').update(phone).digest('hex'),service:{verifications:{async create(){calls++;throw new Error('contains sensitive details');}}}});
 try{await assert.rejects(a.send(),/test stopped/);assert.equal(a.snapshot().sends,1);assert.equal(a.snapshot().reservedCents,100);await assert.rejects(a.send(),/stopped/);assert.equal(calls,1);}finally{a.close();await rm(dir,{recursive:true,force:true});}
});
