// Explicitly invoked integration check. Never runs in builds or ordinary npm test.
// Admin credential remains in process memory; no emails, SMS, payments or deployments occur.
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const url = process.env.SUPABASE_URL;
assert.equal(url,'https://ixpniaronwgjimqyeowq.supabase.co','Only the approved CareText project is allowed');
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const adminKey = process.env.CARETEXT_TEST_ADMIN_KEY;
assert.ok(publicKey?.startsWith('sb_publishable_') && adminKey,'Public and temporary admin credentials required');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(url,adminKey,options);
const client=()=>createClient(url,publicKey,options);
const users=[];
const clients=[];
const ok=result=>{if(result.error)throw new Error(result.error.message);return result.data;};
const denied=result=>assert.ok(result.error,'Expected permission denial');
const pass=message=>console.log(`PASS: ${message}`);
try {
  const anon=client();
  const settings=await (await fetch(`${url}/auth/v1/settings`,{headers:{apikey:publicKey}})).json();
  assert.equal(settings.mailer_autoconfirm,false);
  assert.equal(settings.external.phone,false);
  assert.equal(settings.external.anonymous_users,false);
  pass('email confirmation required; phone and anonymous authentication disabled');
  denied(await anon.from('recipients').select('*'));
  denied(await anon.rpc('create_relationship',{display_name:'Denied',kind:'Friend',phone:null}));
  pass('anonymous table and RPC access denied');
  for(let i=0;i<2;i++) {
    const email=`caretext-verification-${randomUUID()}@example.invalid`;
    const password=`Ct!${randomUUID()}aA9`;
    // generateLink creates an unconfirmed signup without delivering email.
    const signup=ok(await admin.auth.admin.generateLink({type:'signup',email,password,options:{redirectTo:'http://localhost:4173/account.html'}}));
    users.push(signup.user.id);
    const c=client();clients.push(c);
    const unconfirmed=await c.auth.signInWithPassword({email,password});
    assert.ok(unconfirmed.error && /confirm/i.test(unconfirmed.error.message));
    ok(await c.auth.verifyOtp({token_hash:signup.properties.hashed_token,type:'signup'}));
    ok(await c.auth.signOut());
    const signed=ok(await c.auth.signInWithPassword({email,password}));
    assert.equal(signed.user.id,signup.user.id);
    const refreshed=ok(await c.auth.refreshSession());
    assert.equal(refreshed.user.id,signup.user.id);
    const relationship=ok(await c.rpc('create_relationship',{display_name:`Test ${i}`,kind:'Friend',phone:null}));
    const recipient=ok(await c.from('relationships').select('recipient_id').eq('id',relationship).single()).recipient_id;
    users[i]={id:signup.user.id,email,password,relationship,recipient};
  }
  pass('unconfirmed login rejected; confirmation, password login and session refresh work for two accounts');
  const [a,b]=clients;
  const [ua,ub]=users;
  assert.equal(ok(await a.from('recipients').select('id')).length,1);
  assert.equal(ok(await b.from('recipients').select('id').eq('id',ua.recipient)).length,0);
  assert.equal(ok(await b.from('profiles').select('id').eq('id',ua.id)).length,0);
  denied(await b.from('recipients').insert({sender_id:ua.id,display_name:'Forged'}));
  denied(await b.from('relationships').insert({sender_id:ub.id,recipient_id:ua.recipient,kind:'Friend'}));
  denied(await a.from('relationships').update({caretouch_active:true}).eq('id',ua.relationship));
  denied(await a.from('subscriptions').insert({sender_id:ua.id,plan:'Plus',status:'active'}));
  denied(await a.from('consent_events').insert({sender_id:ua.id,relationship_id:ua.relationship,event_type:'verified',phone:'+13125550100',policy_version:'test',provider_event_id:randomUUID()}));
  denied(await a.from('autopilot_settings').insert({sender_id:ua.id,relationship_id:ua.relationship,mode:'manual'}));
  pass('cross-account reads/inserts, mixed-owner relationships and forged consent/plan/activation denied');
  const draft=ok(await a.from('message_drafts').insert({sender_id:ua.id,relationship_id:ua.relationship,content:'Original test'}).select('id').single());
  assert.equal(ok(await b.from('message_drafts').update({content:'Attack'}).eq('id',draft.id).select('id')).length,0);
  assert.equal(ok(await a.from('message_drafts').select('content').eq('id',draft.id).single()).content,'Original test');
  denied(await b.from('message_drafts').insert({sender_id:ub.id,relationship_id:ua.relationship,content:'Attack'}));
  denied(await a.from('message_approvals').insert({sender_id:ua.id,draft_id:draft.id,approved_content:'Wrong text'}));
  ok(await a.from('message_approvals').insert({sender_id:ua.id,draft_id:draft.id,approved_content:'Original test'}));
  ok(await a.from('message_drafts').update({content:'Edited test'}).eq('id',draft.id));
  assert.equal(ok(await a.from('message_approvals').select('approved_content').eq('draft_id',draft.id).single()).approved_content,'Original test');
  pass('cross-account updates denied; approvals preserve exact approved text');
  ok(await a.from('learnme_preferences').insert({sender_id:ua.id}));
  denied(await a.from('learnme_history').insert({sender_id:ua.id,content:'Denied style'}));
  ok(await a.from('learnme_preferences').update({enabled:true,policy_version:'test',opted_in_at:new Date().toISOString()}).eq('sender_id',ua.id));
  ok(await a.from('learnme_history').insert({sender_id:ua.id,content:'Temporary style'}));
  ok(await a.from('learnme_preferences').update({enabled:false}).eq('sender_id',ua.id));
  assert.equal(ok(await a.from('learnme_history').select('id')).length,0);
  pass('LearnMe requires opt-in and deletes style history on opt-out');
  const recovery=ok(await admin.auth.admin.generateLink({type:'recovery',email:ua.email,options:{redirectTo:'http://localhost:4173/account.html'}}));
  ok(await a.auth.verifyOtp({token_hash:recovery.properties.hashed_token,type:'recovery'}));
  denied(await a.auth.updateUser({password:'short'}));
  const newPassword=`New!${randomUUID()}aA9`;
  ok(await a.auth.updateUser({password:newPassword}));
  ok(await a.auth.signOut());
  denied(await a.auth.signInWithPassword({email:ua.email,password:ua.password}));
  ok(await a.auth.signInWithPassword({email:ua.email,password:newPassword}));
  denied(await client().auth.verifyOtp({token_hash:recovery.properties.hashed_token,type:'recovery'}));
  const session=ok(await a.auth.getSession()).session;
  ok(await a.auth.signOut());
  denied(await client().auth.refreshSession({refresh_token:session.refresh_token}));
  pass('recovery token, password minimum, password change, token single-use and sign-out refresh revocation');
} finally {
  const failures=[];
  for(const c of clients) { const response=await c.auth.signOut(); if(response.error) failures.push('session sign-out'); }
  for(const user of users) {
    const id=typeof user==='string'?user:user.id;
    for(const table of ['message_approvals','message_drafts','learnme_history','learnme_preferences','relationships','recipients']) {
      const result=await admin.from(table).delete().eq('sender_id',id);
      if(result.error)failures.push(`${table} cleanup`);
    }
    const result=await admin.auth.admin.deleteUser(id);
    if(result.error)failures.push('temporary auth user cleanup');
  }
  assert.deepEqual(failures,[],'Temporary data cleanup must succeed');
  console.log(`CLEANUP: removed ${users.length} temporary accounts and their test records`);
}
