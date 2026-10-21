import { createClient } from '@supabase/supabase-js';
const $ = selector => document.querySelector(selector);
const status = message => { $('#status').textContent = message; };
// Keep passwords masked initially and after the form is cleared.
document.querySelectorAll('input[type="password"]').forEach((input, index) => {
  input.id ||= `account-password-${index}`;
  input.setAttribute('aria-label', input.closest('label').textContent.trim());
  const wrapper = document.createElement('span');
  wrapper.className = 'password-control';
  input.before(wrapper);
  wrapper.append(input);
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'password-toggle';
  toggle.setAttribute('aria-controls', input.id);
  const setVisible = visible => {
    input.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    toggle.title = visible ? 'Hide password' : 'Show password';
    toggle.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>${visible ? '<path d="m3 3 18 18"/>' : ''}</svg>`;
  };
  setVisible(false);
  toggle.addEventListener('click', () => setVisible(input.type === 'password'));
  input.form.addEventListener('reset', () => setVisible(false));
  wrapper.append(toggle);
});
const config = window.CARETEXT_CONFIG || {};
let user = null;
let recovery = false;
let revision = 0;
const callbackError = new URLSearchParams(location.hash.slice(1)).get('error_description') || new URLSearchParams(location.search).get('error_description');
if(callbackError){status('This email link is invalid or expired. Request a new confirmation or reset link.');history.replaceState(null,'',location.pathname);}
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
    const rows = checked(await client.from('relationships').select('id,kind,caretouch_active,recipients(display_name,phone)').order('created_at'));
    if (current !== revision) return;
    for (const row of rows) {
      const p = document.createElement('p');
      p.textContent = `${row.recipients.display_name} · ${row.kind} · ${row.caretouch_active ? 'CareTouch consent active (delivery disabled)' : 'MyTouch (CareTouch inactive)'}`;
      const link=document.createElement('a');link.href=`app.html?relationship=${encodeURIComponent(row.id)}`;link.textContent=' Edit setup';p.append(link);
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
    if (event === 'PASSWORD_RECOVERY') {recovery = true;sessionStorage.setItem('caretext-recovery',session.user.id);}
    if (session?.user && sessionStorage.getItem('caretext-recovery')===session.user.id) recovery=true;
    if (event === 'SIGNED_OUT') {recovery = false;sessionStorage.removeItem('caretext-recovery');}
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
      } else if (intent === 'resend') {
        if (!$('#login input[type=email]').reportValidity()) return;
        checked(await client.auth.resend({type:'signup',email,options:{emailRedirectTo:redirectTo}}));
        status('If confirmation is needed, check your email for a new link.');
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
      sessionStorage.removeItem('caretext-recovery');
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
