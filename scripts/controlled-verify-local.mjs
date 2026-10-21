import twilio from 'twilio';
import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {join} from 'node:path';
import {existsSync,writeFileSync} from 'node:fs';
import {readVault,vaultPath} from '../src/verify-vault.mjs';
import {controlledVerify,initializeLedger} from '../src/controlled-verify.mjs';
if(!process.argv.includes('--approved-controlled-test'))throw new Error('Explicit controlled-test switch required');
const config=readVault();
const client=twilio(config.accountSid,config.authToken,{autoRetry:false,timeout:20000,logLevel:'error'});
const service=client.verify.v2.services(config.serviceSid);
const preflight=await service.fetch().catch(()=>{throw new Error('Verify preflight failed; no send attempted');});
if(preflight.friendlyName!=='CareText'||preflight.codeLength!==6||preflight.lookupEnabled||preflight.psd2Enabled||preflight.customCodeEnabled)throw new Error('Unexpected service configuration; no send attempted');
const root=vaultPath(),ledger=join(root,'controlled-test.sqlite'),marker=join(root,'test-initialized');
if(process.argv.includes('--initialize-once')){
 if(existsSync(marker)||existsSync(ledger))throw new Error('Test already initialized; do not reset limits');
 initializeLedger(ledger);writeFileSync(marker,'One approved test; never reset this ledger',{flag:'wx'});
}
if(!existsSync(marker)||!existsSync(ledger))throw new Error('Approved test ledger required');
const adapter=controlledVerify({path:ledger,config,service});
const csrf=randomBytes(32).toString('hex');
const html=`<!doctype html><html><head><meta charset="utf-8"><title>CareText controlled OTP test</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:18px system-ui;max-width:700px;margin:40px auto;padding:20px;color:#172d3a}button,input{font:inherit;padding:12px;margin:8px 0}button{cursor:pointer}pre{white-space:pre-wrap;background:#edf5f5;padding:20px}</style></head><body><h1>CareText controlled OTP test</h1><p>Private local test. Only the approved recipient can receive a code. Maximum five sends and $5 reserved budget. No CareTouch messages or recurring consent.</p><p>Enter received codes here only. Codes and credentials are not logged or saved.</p><button id="send">Send one verification code</button><button id="arrived">Confirm the code arrived</button><div><label>Received code <input id="code" type="password" inputmode="numeric" maxlength="6" autocomplete="off"></label></div><button id="verify">Test incorrect code, correct code, and replay protection</button><button id="expire">Test expired code (after 10 minutes 5 seconds)</button><button id="stop">Stop test permanently</button><pre id="status" role="status"></pre><script>
const csrf=${JSON.stringify(csrf)};let busy=false;const status=document.getElementById('status');
async function action(action){if(busy)return;busy=true;for(const b of document.querySelectorAll('button'))b.disabled=true;try{const r=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json','X-CareText-CSRF':csrf},body:JSON.stringify({action,code:document.getElementById('code').value})});const data=await r.json();status.textContent=JSON.stringify(data,null,2);}catch{status.textContent='Local test unavailable';}finally{document.getElementById('code').value='';busy=false;for(const b of document.querySelectorAll('button'))b.disabled=false;}}
for(const [id,op] of [['send','send'],['arrived','arrived'],['verify','verify'],['expire','expire'],['stop','stop']])document.getElementById(id).onclick=()=>action(op);action('status');
</script></body></html>`;
let operation=false;
const server=createServer(async(req,res)=>{
 const reply=(s,data,type='application/json')=>res.writeHead(s,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"}).end(typeof data==='string'?data:JSON.stringify(data));
 if(!['localhost:4175','127.0.0.1:4175'].includes(req.headers.host))return reply(403,{error:'Local host required'});
 if(req.url==='/'&&req.method==='GET')return reply(200,html,'text/html; charset=utf-8');
 if(req.url!=='/api'||req.method!=='POST')return reply(404,{});
 const supplied=req.headers['x-caretext-csrf'];
 if(!['http://localhost:4175','http://127.0.0.1:4175'].includes(req.headers.origin)||typeof supplied!=='string'||supplied.length!==csrf.length||!timingSafeEqual(Buffer.from(supplied),Buffer.from(csrf)))return reply(403,{});
 if(operation)return reply(429,{error:'Operation already running'});
 operation=true;
 try {
  let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>1024)return reply(413,{});}
  const body=JSON.parse(raw);let result;
  const current=()=>adapter.snapshot().attempts.at(-1)?.id;
  if(body.action==='send'){
   result=await adapter.send();
   try{await adapter.send();adapter.record('send_rate_limit','FAIL');adapter.stop();}catch(e){adapter.record('send_rate_limit',/cooldown/.test(e.message)?'PASS':'BLOCKED');}
  }else if(body.action==='verify'){
   if(!/^\d{6}$/.test(body.code||''))throw new Error('Enter the received six-digit code');
   const wrong=body.code.slice(0,5)+((Number(body.code[5])+1)%10);
   const incorrect=await adapter.check(current(),wrong);adapter.record('incorrect_code',incorrect.status==='incorrect'?'PASS':'FAIL');
   if(incorrect.status!=='incorrect'){adapter.stop();throw new Error('Unexpected approval; test stopped');}
   try{await adapter.check(current(),body.code);adapter.record('check_rate_limit','FAIL');adapter.stop();}catch(e){adapter.record('check_rate_limit',/cooldown/.test(e.message)?'PASS':'BLOCKED');}
   await new Promise(resolve=>setTimeout(resolve,2100));
   result=await adapter.check(current(),body.code);adapter.record('correct_code',result.status==='approved'?'PASS':'NOT PASSED');
   if(result.status==='approved'){try{await adapter.check(current(),body.code);adapter.record('local_replay_prevention','FAIL');adapter.stop();}catch(e){adapter.record('local_replay_prevention',/completed/.test(e.message)?'PASS':'BLOCKED');}}
  }else if(body.action==='expire')result=await adapter.check(current(),body.code,{expiryProbe:true});
  else if(body.action==='arrived'){adapter.record('arrival','CONFIRMED BY TESTER');result={ok:true};}
  else if(body.action==='stop'){adapter.stop();result={stopped:true};}
  else if(body.action!=='status')return reply(400,{});
  return reply(200,{result,...adapter.snapshot()});
 }catch(e){return reply(400,{error:e.message,...adapter.snapshot()});}
 finally{operation=false;}
});
server.listen(4175,'127.0.0.1',()=>console.log('CareText controlled test ready at http://localhost:4175 (no sends yet from startup)'));
process.on('SIGINT',()=>server.close(()=>{adapter.close();process.exit(0);}));
