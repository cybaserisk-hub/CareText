// Real browser engines and hosted Supabase; token links generated without email delivery.
import {chromium,webkit,devices,expect as baseExpect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {testAllowlist} from './test-allowlist.mjs';
const expect=baseExpect.configure({timeout:20000});
assert.equal(process.env.SUPABASE_URL,'https://ixpniaronwgjimqyeowq.supabase.co');
const admin=createClient(process.env.SUPABASE_URL,process.env.CARETEXT_TEST_ADMIN_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ok=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
await mkdir('test-results',{recursive:true});
const targets=[['desktop-chromium',chromium,{viewport:{width:1440,height:1000}}],['mobile-android-chromium',chromium,devices['Pixel 7']],['mobile-iphone-webkit',webkit,devices['iPhone 13']]];
for(const [name,engine,device] of targets){
  let browser,userId;
  const email=`caretext-browser-${randomUUID()}@example.invalid`,password=`Ct!${randomUUID()}Aa9`;
  try {
    testAllowlist(email,true);
    const signup=ok(await admin.auth.admin.generateLink({type:'signup',email,password,options:{redirectTo:'http://localhost:4173/account.html'}}));
    userId=signup.user.id;
    browser=await engine.launch();
    const context=await browser.newContext(device);
    const page=await context.newPage();
    page.on('requestfailed',request=>console.log(`NETWORK ${name}: ${new URL(request.url()).origin}${new URL(request.url()).pathname} ${request.failure()?.errorText}`));
    page.on('dialog',dialog=>dialog.accept());
    await page.goto('http://localhost:4173/account.html');
    await page.locator('#login input[name=email]').fill(email);
    await page.locator('#login input[name=password]').fill(password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page.locator('#status')).toContainText('Email not confirmed',{timeout:30000});
    await page.goto(signup.properties.action_link);
    await expect(page.locator('#account')).toBeVisible({timeout:20000});
    await page.getByRole('link',{name:'Continue setup',exact:true}).click();
    await expect(page.locator('#save-status')).toContainText('loaded',{timeout:15000});
    await page.locator('input[value=Plus]').check();
    await page.locator('[data-step="1"]').click();
    await page.locator('input[value=care]').check();
    await page.locator('[data-check=learn]').check();
    await page.locator('[data-step="2"]').click();
    await page.locator('[data-key=name]').fill('Browser Test Parent');
    await page.locator('[data-key=phone]').fill('+13125550100');
    await page.locator('[data-step="3"]').click();
    await page.locator('[data-key=example1]').fill('A private sample for my loved one.');
    await page.locator('[data-key=limits]').fill('Avoid work stress');
    await page.locator('#save-setup').click();
    await expect(page.locator('#save-status')).toContainText('saved securely',{timeout:15000});
    const setupUrl=page.url();
    await page.reload();
    await expect(page.locator('[data-key=example1]')).toHaveValue('A private sample for my loved one.');
    await expect(page.locator('[data-key=limits]')).toHaveValue('Avoid work stress');
    await page.locator('[data-step="2"]').click();
    await expect(page.locator('[data-key=name]')).toHaveValue('Browser Test Parent');
    await page.screenshot({path:`test-results/${name}-onboarding.png`,fullPage:true});
    // A second tab's stale revision cannot silently overwrite the first tab.
    const second=await context.newPage();second.on('dialog',dialog=>dialog.accept());
    await second.goto(setupUrl);await expect(second.locator('#save-status')).toContainText('loaded');
    await page.locator('[data-key=name]').fill('Updated Parent');
    await page.locator('#save-setup').click();await expect(page.locator('#save-status')).toContainText('saved securely');
    await second.locator('[data-key=limits]').fill('Stale edit');
    await second.locator('#save-setup').click();await expect(second.locator('#save-status')).toContainText('another tab');
    await second.close();
    await page.locator('[data-step="1"]').click();await page.locator('[data-check=learn]').uncheck();
    await page.locator('#save-setup').click();await expect(page.locator('#save-status')).toContainText('saved securely');
    assert.equal(ok(await admin.from('learnme_examples').select('slot').eq('sender_id',userId)).length,0);
    assert.equal(ok(await admin.from('relationships').select('caretouch_active').eq('sender_id',userId).single()).caretouch_active,false);
    assert.equal(ok(await admin.from('subscriptions').select('sender_id').eq('sender_id',userId)).length,0);
    await page.locator('#signout').click();await expect(page.locator('#auth')).toBeVisible();
    await page.goto(setupUrl);await expect(page.getByRole('heading',{name:'Sign in to continue'})).toBeVisible();
    await page.goto('http://localhost:4173/account.html');
    await page.locator('#login input[name=email]').fill(email);await page.locator('#login input[name=password]').fill(password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#account')).toBeVisible();
    const recovery=ok(await admin.auth.admin.generateLink({type:'recovery',email,options:{redirectTo:'http://localhost:4173/account.html'}}));
    await page.goto(recovery.properties.action_link);
    await expect(page.locator('#recovery')).toBeVisible({timeout:20000});
    await page.reload();await expect(page.locator('#recovery')).toBeVisible();
    const changed=`New!${randomUUID()}Aa9`;await page.locator('#password input').fill(changed);
    await page.getByRole('button',{name:'Save password',exact:true}).click();await expect(page.locator('#status')).toContainText('Password updated');
    await page.locator('#logout').click();await expect(page.locator('#auth')).toBeVisible();
    await page.locator('#login input[name=email]').fill(email);await page.locator('#login input[name=password]').fill(password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#status')).toContainText('Invalid login credentials');
    await page.locator('#login input[name=password]').fill(changed);await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page.locator('#account')).toBeVisible();await page.locator('#logout').click();
    await page.goto('http://localhost:4173/account.html#error=access_denied&error_description=Expired');
    await expect(page.locator('#status')).toContainText('invalid or expired');
    await page.screenshot({path:`test-results/${name}-auth.png`,fullPage:true});
    console.log(`PASS ${name}: unconfirmed denial, confirmation, persisted onboarding, stale-tab protection, LearnMe cleanup, logout, login, recovery/reload, password change and expired-link message`);
  } finally {
    await browser?.close();
    if(userId){
      for(const table of ['onboarding_states','learnme_examples','learnme_history','learnme_preferences','relationships','recipients'])ok(await admin.from(table).delete().eq('sender_id',userId));
      ok(await admin.auth.admin.deleteUser(userId));
      console.log(`CLEANUP ${name}: temporary account removed`);
    }
    testAllowlist(email,false);
  }
}
