# CareText Supabase foundation

## Implemented

The approved landing page and onboarding are preserved. Open Account from the prototype profile menu to sign up, confirm email, sign in, recover a password, sign out, and save loved ones. Existing demo settings remain separate and are never uploaded. Recipients are sender-owned address-book entries, not login identities; the same phone number may exist under different senders without exposing another account's records. A relationship links one sender and one recipient with a composite ownership foreign key.

`supabase/migrations/` is the executable schema source. Do not run `architecture/db/001_autopilot.sql`; it is an obsolete design starter. All public tables have RLS and explicit grants. The relationship-creation RPC runs as the caller, derives the sender from `auth.uid()`, and creates the profile, recipient, and relationship atomically. Profiles are initialized on the first saved relationship. Accounts without a subscription use Free; the browser cannot modify subscriptions or allowances.

The foundation also includes consent evidence, LearnMe preferences/history, immutable message approval snapshots, usage periods, replacement audit, refund requests, and inactive Autopilot records. These supporting tables are not all connected to UI yet. A saved phone is unverified, and a saved relationship is not an active paid CareTouch recipient. CareTouch activation and Autopilot activation are prohibited by constraints in this phase. There is no sending queue, checkout, provider credential, or worker.

## Configure a development project

1. This checkout is linked to the owner's CareText project `ixpniaronwgjimqyeowq`. Authentication through the local CLI works with the Windows system trust store (`NODE_USE_SYSTEM_CA=1` when needed).
2. Migration `20261021010021_caretext_foundation.sql` has already been applied and verified against remote migration history. Do not reapply it or apply the old architecture starter. Use new migrations for subsequent changes.
3. Enable email/password authentication and email confirmation. Disable anonymous and phone sign-ins. Use a minimum password length of 12. Configure the Site URL and exact allowed redirect URL ending in `/account.html` for each approved environment. For local testing, include `http://localhost:4173/account.html`.
4. Configure a test SMTP provider for confirmation and recovery emails, or use local Supabase Mailpit. Test confirmation, expired links, recovery, refresh, sign-out, and account switching before admitting real users.
5. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in the shell or Netlify's **Builds** environment scope. The key must start with `sb_publishable_`. These values are intentionally public; never supply a secret or service-role key. No server credential is needed by this implementation. A site-level Builds value overrides a shared value only in that scope.
6. Run `npm ci`, `npm test`, `npm run build`. To load a local ignored `.env` file with Node 24, run `node --env-file=.env scripts/build.mjs`. Serve `dist/` over HTTP. Missing configuration presents an unavailable-account message; partial or secret-key configuration fails the build.
7. Security and performance advisors were run against the actual project and both returned no issues. Two-account hosted API verification passed; see CONNECTION_VERIFICATION.md. Repeat these checks after authorization changes.

## Verification and limits

`npm test` executes the actual migration in PGlite (PostgreSQL in WASM), with Supabase roles and `auth.uid()` simulated. It checks anonymous denial, ownership isolation, composite foreign keys, denied entitlement/consent/Autopilot writes, opt-in style storage and opt-out cleanup, immutable approval text, and transaction rollback. This is real PostgreSQL policy execution, but it does not test hosted Supabase Auth, SMTP, PostgREST, or provider webhooks.

The account UI tests use a simulated DOM and mocked Supabase calls to cover configuration failure, signup, login, password reset/recovery, saving a relationship without a caller-supplied sender ID, safe text rendering, and clearing account data on sign-out. A real browser/hosted-email acceptance pass remains required.

Paid activation remains a future server-only operation: lock the account, enforce Essential's one/Plus's five active recipients, enforce one completed voluntary replacement per rolling 30 days, verify exceptions, and check live consent. The schema records evidence but does not implement that activation workflow. Future usage allocation must be transactional and enforce 15/100 SMS across the account, Free's five AI generations, and Plus-only daily delivery. Refund requests require review and the approved 7/14-day policy with legal/service exceptions. Autopilot requires the full 90-day and disclosure checks before any future migration can permit activation. None of those features can be enabled by changing browser state.

Retention/deletion workflows and authenticated recipient consent collection remain future work. Sender deletion is deliberately restricted where audit records exist until that policy is implemented. Phone/name edits and recipient replacement are not exposed in the new account screen, avoiding accidental invalidation of consent evidence.

The remote is `https://github.com/cybaserisk-hub/CareText.git`. Netlify's build command deliberately fails before generating output, blocking production and preview deployment of these changes. The existing published Netlify prototype was not changed. No new deployment, payment, SMS, or external verification email occurred.

Hosted auth configuration is managed with the narrowly scoped file under `ops/supabase-auth/supabase/config.toml`, not the broader local-development config. Review with `npx supabase config diff --project-ref ixpniaronwgjimqyeowq --workdir ops/supabase-auth` before pushing it. Only declared auth settings are updated; existing MFA, storage, pooler and other settings stay intact.
