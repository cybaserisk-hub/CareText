import {execFileSync} from 'node:child_process';
export function testAllowlist(email,enabled){
  if(!/^caretext-(browser|verification)-[0-9a-f-]+@example\.invalid$/.test(email))throw new Error('Only disposable test addresses may be managed by this helper');
  const sql=enabled?`insert into private.signup_allowlist(email) values('${email}') on conflict do nothing`:`delete from private.signup_allowlist where email='${email}'`;
  execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','db','query','--linked','--project-ref','ixpniaronwgjimqyeowq',sql],{env:{...process.env,NODE_USE_SYSTEM_CA:'1'},stdio:'pipe'});
}
