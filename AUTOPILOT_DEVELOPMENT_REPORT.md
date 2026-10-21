# CareText approved development decisions and verification

Baseline: `e233a5c`. Preparation only. No hosted migrations, deployment, OTP, SMS, AI generation, Polar, public registration, Autopilot activation or campaign submission occurred. The controlled Verify gate was not accessed or reopened.

## Completed development work

- Preserved the original Twilio test migration byte-for-byte in `tests/fixtures/migrations/20261021034035_twilio_local_workflow.sql`. SHA-256: `194824ee757056dc3cb381a7fb9c00d50d4644bd2e3cbbb692ae2ea88c996b96`. Explicit fixture loading preserves offline Twilio tests. Hosted history is untouched; first five migrations remain applied. The branch listing returned no branches. Production consent is now the only pending canonical migration.
- Implemented server-oriented offline eligibility and lifecycle controls in `src/autopilot-controls.mjs`, with transactional Postgres/PGlite development storage, rollback on audit failure and sender-wide shared quota state. This is not connected to public APIs or a live provider.
- Auth Admin creation-time loader excludes mutable profile/user metadata. Boundary is exactly 90 elapsed 24-hour days. Distinct completed human-approved audited batches count once; two required.
- Enforced v3 scope, matching sender/recipient/relationship/phone/schedule, provider evidence, suppression, paid plan, recipient cap/replacement entitlement, fresh reviewed preferences, security/provider/audit state and billing-period validity.
- Explicit subscriber opt-in binds version/revision/actor/time. Both in-app and email confirmation records are queued locally. No additional recipient notification is imposed; final compliance review can require it. No confirmation emails are sent.
- Local 08:00 inclusive to 21:00 exclusive time window; valid IANA zone required; DST tests; at most one slot/day/relationship across modes; a missed slot expires after 60 seconds and is not replayed after an outage. This processing tolerance is a conservative development choice, subject to scheduler review.
- GSM-7 extension and UTF-16 segment accounting; 15 Essential / 100 Plus account-wide allocation; idempotent reservation, immutable approval hash and final safety/consent recheck; no live transport exists.
- Manual override/pause cancel queued reservations. Safety, consent, payment, provider, preference, audit, account/global pause incidents suspend and do not auto-resume. Authorized explicit opt-in after revalidation is required. Production STOP/HELP signed routing remains covered by existing tests.
- Content attestation requires every safety category, content hash, relationship/revision/policy binding, recent timestamp and audit evidence. Missing/unknown/stale checks fail closed. This is an evaluator contract, not a functioning semantic AI filter.
- Synthetic restore quarantine model requires separate deletion/suppression evidence, does not revive deleted identities, reapplies suppression and never releases/resumes restored work.

## Important implementation boundaries

**The complete production Autopilot integration is not finished.** The local development engine implements and tests the decision/state contracts, but trusted snapshots are synthetic. Its new SQL is a test fixture, not a production migration. Existing hosted and canonical production `autopilot_settings` still allow only manual/paused. `LIVE_AUTOPILOT_ENABLED=false`; `liveSubmit()` always rejects.

Remaining engineering: authoritative transactional loaders for all consent/subscription/preferences/batch records; immutable production batch completion evidence; atomic sender/phone locks shared with STOP/payment/preference changes; durable scheduler-issued slot provenance; subscriber opt-in/activity UI; idempotent notification delivery outbox; content evaluation provider and multilingual/adversarial policy evaluation; provider submission reconciliation including uncertain results; cross-process concurrency verification. Synthetic safety attestations or browser snapshots must NEVER authorize production sends. Do not mount the development store as a production endpoint.

The production consent migration and expired-link withdrawal remain locally tested, unapplied. No product allowances, pricing, MyTouch/CareTouch or LearnMe policy was changed.

## Hosted read-only findings

- Migration history: five applied, production consent only pending after fixture exclusion. No history repair or applied marker was written.
- Catalog comparison: zero expected table/column/constraint/policy/grant/trigger/plan differences, zero extra table grants or function metadata mismatches; zero active CareTouch relationships; production consent objects absent. Evidence: `docs/consent-compatibility.json`.
- CareText App organization billing shows **Free**, one project. Leaked-password protection is off and requires Pro+. Owner's no-cost condition is not satisfied: **no change made**. Pro is currently from **$25/month**, with possible usage/compute costs. See `SUPABASE_PASSWORD_PROTECTION_REVIEW.md`.
- CareText backup page explicitly says Free does **not** include project backups. No verified backup/export timestamp or actual restore exists. The synthetic restore test is not provider restore evidence. No unconditional deletion promises were added.

## Tests and preparation

Full command: `npm test`. Focused command: `node --test tests/autopilot.test.mjs`. Builds: `node --env-file=.env scripts/build.mjs` and `node scripts/build-review.mjs`. Build outputs are ignored; no credentials/artifacts are committed.

During development, one new quiet-hours assertion initially failed because its synthetic account/batches were not yet eligible at the earlier clock time. The fixture was corrected to isolate the schedule test. No production bypass was added. Final verification: **20 tests passed, 0 failed**; focused Autopilot suite **6 passed**; full app and seven-route review builds passed; `git diff --check` passed. The deployment-blocker command failed intentionally with its public-deployment-disabled error, confirming the guard remains effective.

Production consent SHA-256: `f9df8944192f576c838e506d19cfb5d6b7dac18350c5e654b8dfca7a628b47ae`. Original fixture checksum was reverified after the move. Hosted history was rechecked after exclusion and lists only production consent as pending.

## Exact review deployment scope

Preserved `deployment/review-scope.json`: publicDeploymentApproved=false, approvedConsentEndpoints=[]; seven routes only:

1. `https://caretext.app/privacy`
2. `https://caretext.app/terms`
3. `https://caretext.app/invite`
4. `/style.css`
5. `/legal.css`
6. `/assets/caretext-logo.svg`
7. `/invite/flow.js`

`netlify.toml` still invokes `scripts/deployment-disabled.mjs` unconditionally and points functions to `deployment/no-functions`. Local review output denies every other route with a forced 404, has no account bundle/config/credentials/API handlers and preserves CSP/no-store/no-referrer. Static invitation is disclosure evidence, not functioning consent or phone verification. Existing synthetic screenshots remain valid because consent v3 is unchanged.

Separate approval must name this seven-route static artifact/commit and CareText domain. Do not disable the hard build gate until that scope is approved. Before publishing, verify Netlify site ownership, DNS/certificate, no auto-published functions and exact route-denial behavior. Roll back static review by restoring the prior approved artifact or unpublishing that review site; keep registration and API routes denied. Functional consent, inbound and status endpoints require a distinct reviewed adapter/approval. See `FIRST_RELEASE_DEPLOYMENT_CHECKLIST.md`.

## Remaining blockers and exact next decisions

1. **Backup/staging:** choose an approved encrypted export custodian/location and isolated restore destination, or approve a CareText Pro upgrade and its cost. Set RPO/RTO; perform actual restore and RLS/PostgREST/concurrency validation. No hosted migration before this passes.
2. **Migration:** after validation, separately approve project `ixpniaronwgjimqyeowq`, exact commit and SHA-256 of `20261021041742_production_recipient_consent.sql`, maintenance window and rollback owner. No test fixture is in scope. Prefer disable/fix-forward; preserve evidence and suppression.
3. **Password protection:** a Pro+ upgrade is required on the current plan. No paid change is approved. After an approved upgrade, enable only `password_hibp_enabled`, verify and retest Auth; do not push unrelated configuration.
4. **Static review publication:** separately approve the exact seven routes above. No functional endpoint is included. Public availability remains a Twilio submission blocker.
5. **Autopilot:** complete the production engineering listed above, approve final content safety policy/evaluation thresholds and pass all A01–A16 hosted/provider gates. Current local tests do not satisfy activation approval.
6. **Twilio:** verify Advanced Opt-Out configuration and consistent HELP/support copy; approve bounded real signed callback tests only after endpoint scope is separately approved; complete account/brand/use-case and opt-in evidence review; obtain campaign approval before messaging. No submission authorization yet.
7. **Retention:** implement production deletion/tombstone/hold workflows and verify provider limits. Consent evidence FKs can block account deletion; external logs/backups/mail/provider copies remain unverified. No universal 30/90-day purge guarantee is justified.

No payment, messaging, OTP, public customer registration or Autopilot activation approval is requested implicitly by these preparation changes.
