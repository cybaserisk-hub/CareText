document.querySelector('#decline-invitation').addEventListener('click', () => {
  document.querySelector('#invitation-result').textContent = 'You have not given SMS consent. You can close this page. No verified invitation is attached, so no recipient record was changed.';
});
