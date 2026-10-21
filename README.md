# CareText V5.3 — Netlify / GitHub / Codex handoff

## Development and deployment preparation
- Run `npm ci`, `npm test`, and `npm run build` with Node 24. Serve **dist/** over HTTP for preview.
- GitHub source: https://github.com/cybaserisk-hub/CareText. Supabase: project `ixpniaronwgjimqyeowq` (CareText).
- Public deployment is deliberately blocked by `netlify.toml` and `scripts/deployment-disabled.mjs`. Local builds still work. Do not remove the block without owner approval. No deployment has been performed by this work.
- Account setup: see [SUPABASE_SETUP.md](SUPABASE_SETUP.md). Only a public URL and publishable key enter the browser bundle.
- Keep `architecture/`, `supabase/`, tests, and credentials OUTSIDE the public output.

## Status
The existing onboarding screens now persist recipient profiles, MyTouch/CareTouch preferences, schedules, and optional LearnMe examples in Supabase. Authentication uses a private tester allowlist and CareText-only Resend SMTP. The owner verified signup confirmation, password recovery, new-password login, and rejection of the old password. Hosted authorization tests and in-app browser save/reload, stale-tab, and responsive viewport checks passed. LearnMe opt-out deletes saved examples; its regression test checks stored rows independently of RLS visibility. See [AUTH_ACCEPTANCE.md](AUTH_ACCEPTANCE.md) for remaining device coverage and [CARETEXT_EMAIL_SETUP.md](CARETEXT_EMAIL_SETUP.md) for email configuration. No billing, AI generation, consent collection, SMS, notification workers, or actual autopilot is active. Demo localStorage is never imported into account data and is not authoritative.

Legal draft pages are available at `/privacy`, `/terms`, and `/invite`. CareText remains the product/SMS brand; CyBase Risk Management, LLC is the legal operator. The invitation supports a private local simulated verification flow; it cannot grant live SMS consent. See [RECIPIENT_INVITATION_TESTING.md](RECIPIENT_INVITATION_TESTING.md). Privacy/support inbound delivery and Gmail labeling are verified. Retention/backup deletion enforcement, consent verification, operational request handling, and exact public deployment scope remain pending. See [TWILIO_A2P_COMPLIANCE_CHECKLIST.md](TWILIO_A2P_COMPLIANCE_CHECKLIST.md) for submission blockers.

## Confirmed product rules
- Free: MyTouch, reminders, 5 AI-generated texts/month, copy to personal messaging app, no CareText SMS.
- Essential: $4.99 monthly, one active recipient, 15 CareText SMS/month, no daily CareTouch.
- Plus: $9.99 monthly, up to five active recipients, 100 SMS/month across all, daily allowed within allocation.
- Annual prices proposed: Essential $47.90; Plus $95.90; verify final Polar catalog.
- Both paid plans: ONE voluntary completed recipient replacement per ACCOUNT per rolling 30 days. Verified exceptions for declined invitations, recipient opt-outs, incorrect numbers.
- Initial purchase refund requests: monthly within 7 days; annual within 14 days. Not automatic; legal terms and service failures may require exceptions.
- Polar: renewal date cannot be changed in customer self-service. Show next billing timestamp as reported by Polar.
- MyTouch: personal copy/paste. CareTouch: prior consent + approved batch + scheduled delivery.
- LearnMe™ opt-in only; distinct from recipient data. Trusted Autopilot is part of the FIRST CareText release, with activation after 90 days and explicit opt-in, subject to server-side eligibility and safety checks. Release scope does not authorize enabling it now.

## Codex first task
1. Inspect `site/` and `architecture/`, preserving all existing design and product decisions.
2. Set up Supabase project schema with auth, sender IDs, recipient IDs, relationship IDs, RLS, consent, LearnMe™ preference/history, message approvals, plan allowances, replacement audit, refund request records, and Autopilot state.
3. Implement safe migrations and tests. Do not expose service-role keys in frontend.
4. Do not activate Polar charges, Twilio sends, or autopilot without explicit owner approval and real provider credentials.
5. Move any real backend functions into non-public directories and use verified webhooks and idempotency.

## Production consent implementation

Production invitation/Verify orchestration, immutable consent evidence, entitlement-checked activation, signed STOP/HELP persistence and safe reply routing are implemented and tested locally. The new migration and endpoints are not deployed; paid verification and delivery remain disabled. See [PRODUCTION_CONSENT_DEPLOYMENT.md](PRODUCTION_CONSENT_DEPLOYMENT.md) for the verification report, exact proposed public scope and remaining campaign/operational blockers. The controlled-test sending gate remains closed.

## A2P submission preparation

Read-only hosted catalog compatibility was checked against the five applied migrations; both Twilio local-workflow and production-consent migrations remain pending. See [CONSENT_MIGRATION_REVIEW.md](CONSENT_MIGRATION_REVIEW.md) for the exact migration scope, security finding, backup gates and emergency disable procedure.

`node scripts/build-review.mjs` builds only the restricted local review artifact. Netlify publishing remains blocked. See [RESTRICTED_DEPLOYMENT_REVIEW.md](RESTRICTED_DEPLOYMENT_REVIEW.md), [TWILIO_CAMPAIGN_REVIEW_PACKET.md](TWILIO_CAMPAIGN_REVIEW_PACKET.md) and [TWILIO_ADVANCED_OPTOUT_PLAN.md](TWILIO_ADVANCED_OPTOUT_PLAN.md). No consent endpoints, paid sends or campaign submission are approved by this preparation.

## First-release Trusted Autopilot preparation

New recipient invitations use versioned v3 consent for both delivery models. Autopilot remains disabled until every acceptance criterion passes; existing v1/v2 evidence requires re-consent before Autopilot use. Expired accepted invitations retain a withdrawal-only interface. See [FIRST_RELEASE_PREPARATION_REPORT.md](FIRST_RELEASE_PREPARATION_REPORT.md), [TRUSTED_AUTOPILOT_ACCEPTANCE.md](TRUSTED_AUTOPILOT_ACCEPTANCE.md), and [FIRST_RELEASE_DEPLOYMENT_CHECKLIST.md](FIRST_RELEASE_DEPLOYMENT_CHECKLIST.md). Preparation does not authorize hosted changes or sending.
