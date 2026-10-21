# CareText connection and verification

Verified October 20, 2026 (America/Chicago).

## Connections

- GitHub remote: `https://github.com/cybaserisk-hub/CareText.git`. Initially empty; initialized with this application and its tests.
- Supabase: `https://ixpniaronwgjimqyeowq.supabase.co`, project name CareText. Initial public schema was empty.
- Migration `20261021010021` applied; local and remote history match.
- `.env` contains only the public URL and publishable key and is excluded from Git. No administrative credential was saved to source, configuration, or build output.

## Hosted results

The manual integration script `scripts/verify-hosted.mjs` used two disposable accounts with random credentials and non-deliverable test addresses. Admin-generated confirmation/recovery tokens exercised Auth without sending emails. Administrative credentials were held only in process memory and removed afterward. Data authorization requests used the publishable key plus each user's own session, not the admin client.

- Email confirmation required; unconfirmed password login rejected.
- Phone and anonymous sign-ins disabled.
- Confirmation, password sign-in and refresh worked for both users.
- Anonymous table reads and relationship RPC calls denied.
- Each account saw only its own recipients and profile.
- Forged sender IDs, relationships referencing another owner's recipient, and cross-account draft writes denied.
- Browser writes to subscriptions, consent, CareTouch activation and Autopilot settings denied.
- Approval text must match the draft; later draft edits did not change approval snapshots.
- LearnMe history insertion required opt-in; opting out removed saved history.
- Recovery token worked once; reuse failed. Short password rejected. Password change invalidated the old password.
- Sign-out revoked refresh-token use. Standard Supabase access JWTs may remain valid until expiration; immediate access-token revocation is not claimed.
- Security advisor: no issues. Performance advisor: no issues.
- After cleanup: zero test auth users, profiles, recipients and relationships; zero public tables lacking RLS.
- Local DOM/auth mocks and PostgreSQL policy tests passed; configured static build passed.

## Deliberately inactive and remaining verification

Payments, SMS, AI generation and Autopilot remain inactive. No provider integration or delivery worker exists. `netlify.toml` points to a failing deployment-block script; a reviewed source change and owner approval are required before any new public deployment. A previously published Netlify prototype (`caretextapp`) already existed and was left unchanged.

Auth redirects currently allow only `http://localhost:4173/account.html`; the Site URL is localhost. Password minimum is 12. MFA and unrelated hosted settings were preserved. Local build: `node --env-file=.env scripts/build.mjs`; serve `dist/` on localhost port 4173.

Actual SMTP/email deliverability, expired-link handling in a real browser, full browser acceptance, rate-limit/concurrency testing, and a broader production-readiness review remain outstanding. This is a verified development foundation, not production launch approval. The earlier prototype's localStorage remains demo data and is never treated as a database entitlement or consent record.

To repeat hosted checks, supply `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and a temporary `CARETEXT_TEST_ADMIN_KEY` to the manual verification process. Run `node scripts/verify-hosted.mjs`, then remove the admin environment variable. Never put that key in `.env`, browser settings or Git. The script targets only the approved project and removes the accounts it creates.
