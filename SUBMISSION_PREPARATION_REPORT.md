# A2P submission preparation verification

Historical report for the preceding preparation commit. See `FIRST_RELEASE_PREPARATION_REPORT.md` for current v3 scope, fixed expired-link withdrawal and verification results.

Based on commit `3badc71`. **Prepared, not deployed or submitted.**

## Results

- Read-only hosted migration history and catalog compared with the five applied repository migrations: no expected structural/RLS/grant differences. PostgreSQL 17.11 hosted; PGlite local replay. Two pending migrations explicitly identified in `CONSENT_MIGRATION_REVIEW.md`.
- Hosted security advisor: one warning for disabled leaked-password protection. No hosted settings or schema changed.
- Full `npm test`: **12 passed, 0 failed**. Includes production rejection/expiry/replay/withdrawal/authorization/ambiguity tests, broad-default-grant hardening, preservation of existing data, emergency disable/suppression preservation, and restricted artifact route/file tests.
- Full static build passed. Restricted build passed. A temporary OneDrive file lock interrupted an intermediate rebuild; bounded filesystem retries were added, then the restricted build and its two focused tests passed again.
- Desktop Chromium and mobile Chromium emulation screenshots captured with network restricted to a local server and a synthetic read-only invitation fixture. Checkbox unchecked; withdrawal hidden before acceptance. Visual review found and fixed CSS overriding HTML hidden state. No physical-device or Netlify CDN acceptance is claimed.
- Production disclosure v2 and legal wording distinguish subscriber-approved standard CareTouch from disabled future Autopilot. No plan prices, allowances, MyTouch or LearnMe behavior changed.
- Controlled Verify ledger checked read-only: closed, two total sends from the previous milestone. No additional OTPs, Messages API calls, payment activation, public registration, Autopilot, campaign submission or deployment.

## Exact review artifacts

- `CONSENT_MIGRATION_REVIEW.md`: two-file pending scope, compatibility limits, approval checkpoints, backup/retention gates, verification and non-destructive emergency-disable procedure.
- `deployment/consent-preflight.sql`: read-only schema/aggregate query; `docs/consent-compatibility.json`: sanitized comparison.
- `deployment/consent-disable.sql`: unexecuted hosted emergency procedure; retains evidence and suppression.
- `RESTRICTED_DEPLOYMENT_REVIEW.md`, `netlify.toml`, `deployment/review-scope.json`, `scripts/build-review.mjs`: exact seven-route static artifact, no approved API endpoints, build block retained.
- `TWILIO_CAMPAIGN_REVIEW_PACKET.md`: three sample messages, message-flow draft, classification/content-policy decisions and labeled synthetic opt-in screenshots.
- `TWILIO_ADVANCED_OPTOUT_PLAN.md`: proposed settings, START mismatch, approved-scope-only test steps.
- `TWILIO_A2P_COMPLIANCE_CHECKLIST.md`: remaining submission and launch blockers.

## Still blocked

Actual backup/restore/deletion controls; hosted migration and post-migration RLS/concurrency acceptance; reviewed endpoint adapter; public legal/evidence access; Advanced Opt-Out and real signed callbacks; re-enrollment/START behavior; campaign business/use-case/sample approval and registration. Future delivery still needs template/segment accounting, approved-batch scheduling and final consent/suppression gating. A static review deployment alone does not resolve these blockers.

The accepted invitation's API supports withdrawal after expiry, but the current view branch rejects expired links before rendering the withdrawal UI. Before hosted acceptance, resolve and browser-test that recipient experience; STOP and monitored support remain the documented alternate withdrawal paths when the SMS program is available. No claim is made that every production recipient workflow is launch-ready.

All external changes require their own approval. This report is implementation evidence, not carrier acceptance or legal certification.

## Subsequent owner clarification

Trusted Autopilot is required in release one. Earlier wording excluding it is superseded as a release plan; the feature remains disabled in the current implementation. Current v2 disclosures and screenshots are standard-only preparation evidence and need revision before submission. See the updated campaign packet and checklist. No gates were enabled.
