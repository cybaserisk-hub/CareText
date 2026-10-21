import { createClient } from '@supabase/supabase-js';
const $ = selector => document.querySelector(selector);
const status = message => { $('#status').textContent = message; };
const config = window.CARETEXT_CONFIG || {};
let user = null;
let recovery = false;
let revision = 0;
if (!config.url || !config.key) {
  status('Account setup is not connected yet. You can still explore the prototype.');
} else {
  const client = createClient(config.url, config.key);
  const checked = result => { if (result.error) throw result.error; return result.data; };
  const redirectTo = new URL('account.html', location.href).href;
  async function refresh(session) {
    const current = ++revision;
    user = session?.user || null;
    $('#recipients').replaceChildren();
    $('#identity').textContent = '';
    $('#recipient').reset();
    $('#auth').hidden = !!user;
    $('#account').hidden = !user || recovery;
    $('#recovery').hidden = !user || !recovery;
    if (!user || recovery) return;
    $('#identity').textContent = user.email;
    const rows = checked(await client.from('relationships').select('id,kind,recipients(display_name,phone)').order('created_at'));
    if (current !== revision) return;
    for (const row of rows) {
      const p = document.createElement('p');
      p.textContent = `${row.recipients.display_name} · ${row.kind} · MyTouch (CareTouch inactive)`;
      $('#recipients').append(p);
    }
  }
  async function run(action) {
    const buttons = [...document.querySelectorAll('button')];
    buttons.forEach(button => button.disabled = true);
    status('Working…');
    try { await action(); } catch (error) { status(error.message || 'Unable to complete the request. Please try again.'); }
    finally { buttons.forEach(button => button.disabled = false); }
  }
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') recovery = true;
    if (event === 'SIGNED_OUT') recovery = false;
    // Supabase callbacks must not await another auth request while the lock is held.
    setTimeout(() => refresh(session).catch(error => status(error.message)), 0);
  });
  $('#login').addEventListener('submit', event => {
    event.preventDefault();
    const values = new FormData(event.target);
    const email = String(values.get('email')).trim();
    const password = String(values.get('password'));
    const intent = event.submitter?.value;
    run(async () => {
      if (intent === 'reset') {
        if (!$('#login input[type=email]').reportValidity()) return;
        checked(await client.auth.resetPasswordForEmail(email, {redirectTo}));
        status('If this account exists, check your email for a password reset link.');
      } else if (intent === 'signup') {
        checked(await client.auth.signUp({email,password,options:{emailRedirectTo:redirectTo}}));
        status('Check your email to confirm your account before signing in.');
      } else {
        checked(await client.auth.signInWithPassword({email,password}));
        status('Signed in.');
      }
      event.target.reset();
    });
  });
  $('#password').addEventListener('submit', event => {
    event.preventDefault();
    run(async () => {
      checked(await client.auth.updateUser({password:new FormData(event.target).get('password')}));
      recovery = false;
      event.target.reset();
      await refresh(checked(await client.auth.getSession()).session);
      status('Password updated.');
    });
  });
  $('#logout').addEventListener('click', () => run(async () => {
    checked(await client.auth.signOut());
    await refresh(null);
    status('Signed out.');
  }));
  $('#recipient').addEventListener('submit', event => {
    event.preventDefault();
    const values = new FormData(event.target);
    run(async () => {
      checked(await client.rpc('create_relationship', {display_name:values.get('name').trim(),kind:values.get('kind'),phone:values.get('phone').trim() || null}));
      await refresh(checked(await client.auth.getSession()).session);
      status('Loved one saved. No invitation or SMS was sent.');
    });
  });
}
