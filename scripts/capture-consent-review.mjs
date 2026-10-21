// Local visual evidence only. No Supabase/Twilio clients, paid attempts, or public server.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
import {buildReview} from './build-review.mjs';
import {DISCLOSURE} from '../src/invitation-service.mjs';
import {CONSENT_POLICY} from '../src/production-consent.mjs';
const scope=await buildReview();
const server=createServer(async(req,res)=>{
 const file=scope.routes[new URL(req.url,'http://local').pathname];
 if(!file){res.writeHead(404,{'content-type':'text/plain'});res.end('Not available');return;}
 const type=file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':'text/html';
 res.writeHead(200,{'content-type':type});res.end(await readFile('review-dist/'+file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;let browser;
try{
 browser=await chromium.launch();await mkdir('docs/evidence',{recursive:true});const hashes=[];
 for(const [name,options] of [['desktop',{viewport:{width:1280,height:1000}}],['mobile',devices['Pixel 7']]]){
  const context=await browser.newContext(options);const page=await context.newPage();let expired=false;const actions=[];
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();
   if(url.pathname==='/api/invitations'){
    const body=route.request().postDataJSON();actions.push(body.action);assert.ok(['view','withdraw'].includes(body.action));
    if(body.action==='withdraw')return route.fulfill({json:{ok:true,status:'withdrawn'}});
    return route.fulfill({json:{test_only:false,status:expired?'accepted':'pending',withdrawal_only:expired,can_withdraw:expired,sender:'Alex (synthetic review example)',frequency:'Weekly',phone_hint:'Synthetic recipient; no real phone number',policy_version:CONSENT_POLICY,disclosure:DISCLOSURE}});
   }
   return route.continue();
  });
  await page.goto(origin+'/invite#token='+'a'.repeat(64));await page.locator('#invite-details').waitFor({state:'visible'});
  assert.equal(await page.locator('#sms-consent').isChecked(),false);
  assert.equal(await page.locator('#withdraw-consent').isVisible(),false);
  await page.locator('#invite-notice').evaluate(el=>{el.textContent='LOCAL REVIEW FIXTURE — synthetic subscriber and schedule. No OTP sent and no consent recorded. This is not a live opt-in proof URL.';});
  const file=`docs/evidence/invitation-${name}.png`;await page.screenshot({path:file,fullPage:true});
  hashes.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
  expired=true;await page.reload();await page.locator('#withdraw-consent').waitFor({state:'visible'});
  assert.equal(await page.locator('#consent-form').isVisible(),false);
  await page.locator('#invite-notice').evaluate(el=>{el.textContent='LOCAL REVIEW FIXTURE — expired invitation with a previously granted synthetic consent. Withdrawal remains available. No real consent or sending.';});
  const withdrawal=`docs/evidence/expired-withdrawal-${name}.png`;await page.screenshot({path:withdrawal,fullPage:true});
  hashes.push({file:withdrawal,sha256:createHash('sha256').update(await readFile(withdrawal)).digest('hex')});
  await page.locator('#withdraw-consent').click();await page.locator('#invite-status').filter({hasText:'SMS consent withdrawn'}).waitFor();
  assert.equal(await page.locator('#withdraw-consent').isVisible(),false);assert.deepEqual(actions,['view','view','withdraw']);
  await context.close();
 }
 await writeFile('docs/evidence/manifest.json',JSON.stringify({kind:'local synthetic visual evidence; not hosted acceptance',disclosureVersion:CONSENT_POLICY,files:hashes},null,2)+'\n');
 console.log('Desktop and mobile invitation evidence captured; no external network or sends.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
