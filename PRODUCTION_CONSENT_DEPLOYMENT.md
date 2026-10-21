# Production recipient consent: deployment plan and verification report

Status: **Implemented and tested locally; not deployed or enabled.** Based on `ea0bd43`. No new paid verification requests, hosted migrations, public endpoints, delivery, payments, signup changes or Autopilot activation were performed. The previously closed controlled-test ledger stays closed and is never imported by the production runtime.

## Implemented

`src/production-consent.mjs` composes the existing `/api/invitations` actions with the dedicated CareText Verify service. Both endpoint availability and paid verification default off. Hosting must supply authenticated server-only Supabase and Twilio clients; no secret is bundled in the website. The existing invitation page retains its layout, supports production disclosures and withdrawal, and continues to label simulated evidence separately. The sender saves a display name before creating an invitation; the server snapshots that name from the owned profile.

The new migration `20261021041742_production_recipient_consent.sql` is **unapplied to hosted Supabase**. It adds private invitation, consent state, immutable evidence, suppression, inbound quarantine, outbound callback registry and durable rate-limit tables. An invoker RPC is executable only by service_role. RLS and explicit grants deny anonymous/authenticated access to private data; routed replies have sender-specific read access. A database trigger rejects activation without eligible recorded consent.

Evidence contains recipient/sender/relationship IDs, phone, exact disclosure/version, frequency, server timestamp, Verify account/service/verification IDs and provider approval status. Opaque token hashes are stored; raw invitation tokens remain in URL fragments. Provider checks use the saved SID and phone, not browser-supplied approval claims. Test tables cannot grant production consent.

Granting consent is atomic with activation, eligibility and replacement checks. Phone/schedule changes invalidate pending invitations and delivery eligibility. Free cannot request CareTouch verification or activate; Essential cannot use daily CareTouch and has one active recipient; Plus has five. Active subscriptions are required. One voluntary replacement per account per rolling 30 days is enforced; recorded withdrawal supports an audited opt-out exception. Other replacement exceptions require documented support handling, not a user-asserted reason. Billing, AI allowances, MyTouch and LearnMe code/rules are unchanged.

Delivery remains blocked in `requireDeliveryEligibility` and the database result always returns `delivery_allowed=false`. A future dispatcher must additionally implement atomic quota reservation (15/100 SMS segments), approved-content/schedule checks, final suppression checks, provider idempotency and cancellation of provider-side queues. No dispatcher or Messages API sender is added in this milestone.

## STOP, HELP and replies

The existing official-SDK signature validator is now composed with production persistence. It validates fixed external URLs, all parameters, account/service/number context and bounded form payloads. Invalid signatures never mutate state. Inbound MessageSid is deduplicated transactionally; status callbacks require a known message and cannot regress terminal state.

STOP takes a shared phone lock, suppresses all sender relationships for that number, withdraws their consent, deactivates them and cancels locally queued outbound records. START never clears suppression; re-enrollment after STOP requires a separate reviewed process. Web withdrawal affects the specific invitation's relationship. HELP records the branded support response for audit; the webhook returns empty TwiML and sends no response while sending is prohibited. At eventual activation, configure Twilio Advanced Opt-Out to send the approved STOP/HELP confirmations and forward OptOutType, avoiding duplicate replies from CareText.

Ordinary replies are visible to a subscriber only when exactly one current, active, consented relationship matches the phone and saved setup. Multiple matches are quarantined privately as ambiguous; zero matches remain private/unmatched. No sender receives ambiguous content. An operator review interface and a recipient-safe disambiguation protocol are future work; do not route by most-recent sender as a shortcut.

## Minimum eventual public scope — approval required

| Endpoint | Audience and controls |
| --- | --- |
| `GET /privacy`, `GET /terms` | Reviewer-accessible HTTPS legal pages; verified operator/support details; no customer data |
| `GET /invite` and required CSS/logo/JS | Public shell only; token in fragment; no-referrer, CSP, no third-party analytics; no token or PII in access logs |
| `POST /api/invitations` | Single dispatcher for create/view/challenge/verify/decline/revoke/withdraw. Fixed same-origin JSON requests, bounded body, server-derived IP HMAC rate bucket. Create/revoke require verified Supabase identity; ownership checked in SQL. Bearer invite actions require cryptographically random token, bound phone, expiry, current disclosure/snapshot, limits and provider attestation. Withdrawal remains available after invitation expiry. |
| `POST /api/twilio/inbound` | Twilio only: SDK signature, canonical external URL, account/service/number checks, transactional deduplication, suppression and quarantine. No browser CORS access or SMS response |
| `POST /api/twilio/status` | Needed only when outbound delivery is separately approved: same signature/context checks; known outbound SID and monotonic state. May remain unpublished during consent-only review |

No public signup/account/onboarding routes, payment hooks, message dispatch route or Autopilot worker are needed for this deployment scope. Authenticated existing testers can create invitations through the private account UI. The host must enforce the exact route allowlist; deploying all of dist would exceed the proposed scope.

The host adapter must derive `clientIp` from the trusted platform request context, not an arbitrary browser forwarding header, and pass server-only configuration into `createProductionConsentRuntime`. Use a stable private rate-secret, Supabase secret, narrowly scoped Twilio credentials and signature-validation auth token in host secret storage. Do not import the controlled-test vault. Use the fixed dedicated Verify SID; no caller-selected service. The function is intentionally not mounted by the local preview or a Netlify entrypoint yet.

Before deployment: review/apply migration in a controlled environment; run hosted RLS/advisor checks; validate backups and restore procedures; configure HTTPS origin/canonical callback URLs and CSP; prove isolation of ambiguous replies; add retention maintenance for rate buckets and private evidence. Expired bucket cleanup is not scheduled yet. Obtain explicit endpoint-scope approval before changing the existing Netlify build block. Obtain a separate bounded verification-send approval before enabling provider calls.

## Verification

- Full automated suite: **10 tests passed** (including existing authentication, onboarding, database isolation and controlled-OTP tests).
- Production integration test executes all migrations in local PGlite PostgreSQL and uses mocked Twilio responses; **zero paid attempts**.
- Verified affirmative/version rejection, wrong code/context, expiration, stale setup, duplicate submission protection, decline, withdrawal, cross-sender denial, RLS denial, STOP deduplication, HELP no-send response, START non-reactivation, queued cancellation, unique reply routing and multi-sender quarantine.
- Verified Free and Essential daily denial before provider sends, Essential capacity, account-wide rolling replacement limit, direct database activation denial, HTTP same-origin/identity requirements, durable request limits, disabled runtime and delivery gate.
- Existing invitation UI test verifies unchecked consent, production labels and withdrawal. Local static build passes. No hosted migration or real-provider end-to-end production-consent claim is made.

## Remaining campaign-registration work

1. Review the actual approved brand record and business identity/EIN/contact against CyBase Risk Management, LLC; CareText remains the customer-facing/SMS brand. Brand approval alone is not campaign approval.
2. Finalize accurate campaign use case, representative samples, frequency, message flow and AI/Trusted Autopilot disclosures reflecting only implemented/enabled behavior. Explain separately requested Verify OTPs before recurring-message consent.
3. Provide approved reviewer-accessible `/privacy`, `/terms`, `/invite` evidence (or acceptable opt-in proof for the gated flow). Privacy and Terms URLs are required for campaign registration.
4. Approve/configure Advanced Opt-Out and branded HELP/STOP responses, and test real signed callbacks only under a separately approved scope. Keep sending disabled until approved.
5. Complete retention/deletion/provider-backup validation and privacy/support operational procedures; publish no unsupported guarantees.
6. Register the campaign, associate the existing Messaging Service/number, resolve review feedback, and independently approve any eventual recurring-message launch. The tested local consent milestone does not itself authorize launch.

References: [Twilio required business/campaign information](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/collect-business-info), [registration quickstart](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/quickstart), [required policy URLs](https://www.twilio.com/en-us/changelog/a2p-10dlc-campaign-registration-will-require-privacy-policy-and-), [Advanced Opt-Out](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out).

## Subsequent submission preparation

The latest exact scope is in `CONSENT_MIGRATION_REVIEW.md` and `RESTRICTED_DEPLOYMENT_REVIEW.md`. Read-only hosted comparison passed against five applied migrations; the earlier local Twilio migration is also still pending. Production disclosure is now `caretext-sms-consent-v2`, explicitly excluding future Autopilot. Netlify's restricted artifact contains no approved API endpoints. No migration or publication was performed. See `TWILIO_CAMPAIGN_REVIEW_PACKET.md` for synthetic opt-in evidence and `TWILIO_ADVANCED_OPTOUT_PLAN.md` for pending provider settings.
