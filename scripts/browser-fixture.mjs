// Local browser-test fixture. No email is sent; credentials never enter source or logs.
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {writeFile,readFile,mkdir,unlink} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {testAllowlist} from './test-allowlist.mjs';
assert.equal(process.env.SUPABASE_URL,'https://ixpniaronwgjimqyeowq.supabase.co');
const client=createClient(process.env.SUPABASE_URL,process.env.CARETEXT_TEST_ADMIN_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ok=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
const path='test-results/browser-fixture.json';
if(process.argv[2]==='cleanup'){
  const fixture=JSON.parse(await readFile(path,'utf8'));
  for(const table of ['onboarding_states','learnme_examples','learnme_history','learnme_preferences','relationships','recipients'])ok(await client.from(table).delete().eq('sender_id',fixture.id));
  ok(await client.auth.admin.deleteUser(fixture.id));testAllowlist(fixture.email,false);await unlink(path);console.log('Temporary browser fixture removed.');
}else if(process.argv[2]==='recovery'){
  const fixture=JSON.parse(await readFile(path,'utf8'));
  const recovery=ok(await client.auth.admin.generateLink({type:'recovery',email:fixture.email,options:{redirectTo:'http://localhost:4173/account.html'}}));
  fixture.link=recovery.properties.action_link;await writeFile(path,JSON.stringify(fixture));console.log('Local recovery link prepared.');
}else{
  const email=`caretext-browser-${randomUUID()}@example.invalid`;
  testAllowlist(email,true);
  let signup;
  try{signup=ok(await client.auth.admin.generateLink({type:'signup',email,password:`Ct!${randomUUID()}Aa9`,options:{redirectTo:'http://localhost:4173/account.html'}}));}catch(error){testAllowlist(email,false);throw error;}
  await mkdir('test-results',{recursive:true});await writeFile(path,JSON.stringify({id:signup.user.id,email,link:signup.properties.action_link}));console.log('Temporary browser fixture ready; local-only link available.');
}
