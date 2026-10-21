# Recipient invitation workflow — private test mode

Implemented on October 20, 2026. Public deployment, payments, registration and SMS remain disabled.

## Implemented

- Saved CareTouch setup creates an opaque 256-bit invitation token through a loopback-only API. Server validates the signed-in subscriber with Supabase getUser and uses the verified account email as sender identity. Client-supplied sender names, schedule, disclosure and phone are not trusted.
- Supabase stores only the token hash. Invitations expire after 24 hours; creating a new invitation revokes prior pending invitations for that relationship. Setup snapshot/revision or phone changes invalidate old invitations.
- Recipient sees subscriber identity, frequency, masked phone, disclosure version, AI/approval/Autopilot explanation and Privacy/Terms links. SMS checkbox starts unchecked and is separate. Decline does not require consent or a code.
- Verification uses a cryptographically random six-digit SIMULATED code printed only in the local server terminal. No provider is contacted. The database stores an HMAC, with a five-minute expiry, five total attempts, 30-second resend cooldown and three challenge requests per invitation. Creation is limited to ten per subscriber per hour; HTTP requests are limited to thirty per loopback client per minute.
- Acceptance atomically consumes the challenge under a row lock and appends private test evidence: subscriber, relationship, phone, exact disclosure/version, frequency, method and server timestamp. Replays fail. Decline and sender revocation also append events.
- Test evidence is isolated in private.recipient_consent_test_events and constrained to live_consent=false. It never writes a verified public.consent_events row or enables relationships.caretouch_active.
- Anonymous and authenticated clients cannot read private invitation/evidence tables or call the service-role-only invoker RPC. No new security-definer function exists. Service keys stay in the local server process.

## Run locally

Build with `node --env-file=.env scripts/build.mjs`. Set CARETEXT_INVITATION_TEST_MODE=1 and a server-only CARETEXT_TEST_ADMIN_KEY in the process environment, then run `node --env-file=.env scripts/serve-local.mjs`. Do not store the key in Git or browser configuration. Without this explicit mode the API returns 503. The server binds 127.0.0.1:4173 and rejects non-local Host/Origin requests. No Netlify or Edge endpoint was deployed.

Sign in to a private tester account, save a CareTouch setup, and use Create test invitation below onboarding. Open its localhost link on this computer. Enter the invited number, request a test code, obtain it from the operator's terminal, check separate consent and accept. The result must say test acceptance, not verified phone ownership. A server restart invalidates outstanding code HMACs; request a new challenge within the limits.

## Evidence

- PostgreSQL/PGlite integration tests: account authorization, missing/foreign relationship, unknown token, wrong phone, missing affirmative choice, disclosure mismatch, acceptance, replay, revocation, decline, resend cooldown, attempt lockout, link/code expiry, setup change invalidation and denied anon/authenticated DB access passed.
- Existing auth/onboarding/security tests passed.
- CareText hosted migration applied. Security advisor: no new findings; pre-existing leaked-password-protection warning remains.
- Desktop browser: created invitation from saved disposable setup, requested simulated code, accepted, reloaded and observed accepted_test persisted.
- Second invitation: decline completed in browser; 390px viewport measured no horizontal overflow. Physical-device/Safari coverage remains pending.
- Independent hosted query verifies accepted_test/declined evidence, live_consent=false, zero live consent events and zero active delivery relationships. Disposable fixture/evidence removed after testing.
- Local proof: test-results/recipient-test-consent.png. Screenshots are ignored by Git.

## Approval and implementation still required

This is NOT real phone verification or production consent. Before any real verification SMS: owner approval for the exact provider/service, test phone numbers, spending scope and sending; provider credentials; server-side provider verification checks; webhook validation as applicable; fraud controls and durable distributed rate limits. No switch in this implementation activates live delivery.

Public deployment needs separate approval of exact routes and hosting controls. A production backend, provider-attested consent evidence, STOP/HELP/suppression/replies, invitation delivery channel, physical-device tests and retention/deletion enforcement remain necessary before Twilio submission. Test evidence must never be promoted to live consent. Future real recipients must complete a fresh approved verification flow.
