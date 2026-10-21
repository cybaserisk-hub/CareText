> Historical report. Latest approved decisions, work and blockers: `AUTOPILOT_DEVELOPMENT_REPORT.md`.

# First-release preparation report

Baseline: `adfa217`, including the owner's subsequent first-release scope correction. **No hosted migration, public deployment, OTP/SMS send, payment, Autopilot activation or campaign submission performed.**

## Completed and verified

- Campaign description/message flow, Privacy, Terms and invitation now describe standard subscriber-approved CareTouch AND first-release Trusted Autopilot: automatic AI generation/delivery after 90 days for eligible subscribers who explicitly opt in. All remain conditional on safeguards and disabled today.
- New invitations use `caretext-sms-consent-v3`. Exact disclosure/version stays in immutable evidence. Existing v1/v2 records are not altered or reinterpreted; Autopilot requires new verified affirmative v3 consent. Legacy link checkbox wording does not imply Autopilot permission. Server model-scope checks reject old/unknown policies for Autopilot, and all actual delivery remains denied.
- Expired accepted links render withdrawal only. Expiry still rejects challenge/check/accept. Superseded links cannot revoke a newer grant. Repeated withdrawal is idempotent. Invalid or expired never-accepted links cannot create consent.
- New PostgreSQL integration test successfully applies the five hosted migrations plus production consent WITHOUT the private Twilio test migration. Recommendation: exclude that test migration via the audited repository relocation procedure in `CONSENT_MIGRATION_REVIEW.md`; do not fake history entries. Both files remain in the pending queue until that decision is approved.
- Read-only hosted migration history still shows the first five versions applied and both later versions pending. Security advisor still reports leaked-password protection disabled; no setting changed.
- Full automated suite: **14 passed, 0 failed**. After final legacy-label/withdrawal-copy refinement, all three affected UI/consent tests passed again. Full application and restricted static builds passed.
- Desktop and mobile Chromium fixtures verify unchecked v3 consent and expired accepted withdrawal visibility/action; screenshots and hashes refreshed in `docs/evidence/manifest.json`. No external network, real recipient, paid verification or actual consent is involved in these fixtures. Physical-device, hosted Supabase/PostgREST and Netlify CDN acceptance remain pending.

## Review documents

| Document | Review purpose |
| --- | --- |
| `TWILIO_CAMPAIGN_REVIEW_PACKET.md` | Initial two-model consent, campaign description/flow, samples, synthetic opt-in evidence |
| `TRUSTED_AUTOPILOT_ACCEPTANCE.md` | A01-A16 acceptance criteria, provenance and unimplemented launch requirements |
| `CONSENT_MIGRATION_REVIEW.md` | Exact pending SQL, exclusion recommendation, compatibility, RLS and phase-specific disable procedure |
| `BACKUP_RETENTION_VALIDATION_PLAN.md` | Provider limitations, request/delete lifecycle and isolated restore-time suppression/deletion replay |
| `FIRST_RELEASE_DEPLOYMENT_CHECKLIST.md` | Static/API/launch scopes, security and rollback separation |
| `SUPABASE_PASSWORD_PROTECTION_REVIEW.md` | Exact setting, Pro+ availability, conditional cost and post-change tests |
| `TWILIO_A2P_COMPLIANCE_CHECKLIST.md` | Current readiness, unresolved operational/provider/owner requirements |

## Exact next decisions

1. **Migration strategy:** approve excluding only `20261021034035_twilio_local_workflow.sql` from production after checking all shared histories, preserving it as a test fixture and updating test loaders. Then separately approve application of the reviewed `20261021041742_production_recipient_consent.sql` to CareText after backup/staging acceptance. Current directory still contains both; no blanket push.
2. **Product acceptance:** confirm the design's account-age clock (90 elapsed days from trusted Auth account creation) and two completed human-approval cycles; approve content/safety evaluation rules, mode-change notification, timezone/quiet-hour defaults and suspension/resume process. Implement and test all criteria before any activation request.
3. **Retention/recovery:** approve a named request/recovery owner, RPO/RTO, isolated restore destination and cost ceiling, evidence-retention clock/holds, provider limitations and deletion replay design. No promises of universal provider erasure or successful restore until verified.
4. **Auth protection:** confirm current CareText organization plan/entitlement; approve the CareText-only `password_hibp_enabled=true` change. If an upgrade is required, obtain and approve an actual quote first. Pro is publicly advertised from $25/month; actual incremental cost is unknown.
5. **Static review:** approve final v3 legal/campaign wording and only the seven static paths in `deployment/review-scope.json`, with explicit CareText site/domain replacement scope. This does not authorize any API or sending.
6. **Functional testing:** separately approve `/api/invitations` and `/api/twilio/inbound` only after host adapter/security/hosted RLS readiness; `/api/twilio/status` remains deferred. Supply a new bounded test destination/budget/send count if real OTPs or provider-generated replies are needed. Previous controlled-test authorization remains closed.
7. **Submission and launch:** resolve START/re-enrollment, campaign classification/embedded-content flags, business record and reviewer proof; approve campaign submission/fees separately. Sending, payments, public registration and Autopilot activation each remain off until their full requirements and independent approvals are satisfied.

## Remaining blockers

Autopilot runtime and AI safety/provider integration, active subscription source, approved-batch/segment/quota/queue/idempotency/suspension controls, subscriber in-app/email mode-change confirmations and required re-consent; hosted migration and acceptance; actual backup/retention/deletion/restore implementation; leaked-password protection; approved public evidence and API adapter; real signed provider callback tests; final campaign/business/use-case review and carrier approval. The expired-invitation withdrawal defect is fixed locally and is no longer an implementation blocker, but must pass hosted acceptance.

The existing emergency SQL revokes the shared RPC and therefore also blocks STOP persistence. It is explicitly limited to the pre-messaging phase. Before customer traffic, implement a rollback path that stops generation/dispatch while keeping signed STOP intake and durable suppression available. Never restore stale consent or resume automatically.
