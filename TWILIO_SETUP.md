# CareText Twilio configuration preparation

Console inspected October 20, 2026 (America/Chicago). Preparation only: no settings saved, credentials revealed, verification texts sent, campaign submitted, or deployment performed.

## Verified inventory

| Item | Console evidence |
| --- | --- |
| Account | Verified in Twilio Console (My First Twilio Account); account SID omitted from source control |
| CareText number | `+14246672273` |
| Phone Number SID | `PN6b411c6a794eb680ff5e6b0361d91de5` |
| Messaging Service SID | `MG444fa12ec1f01b8d68a82f0432dcf62e` |
| Sender association | Service Senders tab lists this number as Local - 10DLC, SMS/MMS; one sender |
| Number messaging status | Disabled; Complete A2P registration |
| Service inbound handling | Defer to sender's webhook |
| Number primary / backup webhook | Both blank, POST |
| Delivery status callback | Blank |
| Advanced Opt-Out | Not enabled; console offers Enable advanced opt-out |
| Existing keywords | STOP; START/UNSTOP; HELP, with generic responses |
| Verify services | No services added yet |

Brand approval / absence of campaigns was reported by the owner; this inspection did not independently audit the brand or campaign record. Disabled A2P messaging is not a substitute for an application sending gate and does not establish that Verify sending is disabled account-wide.

## Local implementation and test status

The provider adapter and signed webhook handler are now implemented for offline testing. `src/twilio-verify.mjs` uses the pinned official Twilio SDK with an explicitly injected local transport; this build rejects live mode and never constructs a network transport. `src/twilio-invitations.mjs` binds checks to the database invitation, saved phone, provider SID and reservation. Attempts, cooldowns and expiry are enforced in PostgreSQL. A new application instance can resume the stored challenge.

`src/twilio-webhooks.mjs` validates signatures against fixed canonical URLs and all form parameters, checks account/service/number context, and persists before acknowledging. Private local test tables deduplicate inbound messages, retain HELP response previews without sending them, record replies, suppress STOP recipients and cancel queued test messages. START never clears suppression. Known outbound status callbacks cannot reverse terminal state. No dispatch worker exists.

The new migration `20261021034035_twilio_local_workflow.sql` is **local only, not applied to hosted Supabase**. Its RPC is service-role-only, SECURITY INVOKER, with RLS enabled on private tables. Test evidence remains `live_consent=false`; the production consent and CareTouch activation tables remain untouched. This is not proof of real phone ownership or production consent handling.

### Run locally

1. Run `npm test` for the full test suite, or `node --test tests/twilio.test.mjs` for provider/security checks.
2. Build the existing site locally using the established build command.
3. Run `node scripts/twilio-local-harness.mjs --local-test`.
4. Open the invitation URL printed by the harness on localhost:4174. Use synthetic phone `+12025550123`; request the code and read it from the terminal, then use the separate checkbox and Accept button. No text is sent.
5. Reload to see `accepted_test`. Stop the harness with Ctrl+C. Its isolated, in-memory PostgreSQL database and synthetic challenges are discarded when it stops.

The harness has no .env loading, real credentials, external database access or network provider transport. It only binds 127.0.0.1. The regular preview server returns 503 for `/api/twilio/*`. The existing hosted invitation simulator remains separate.

Validation: all six test cases passed across the suite; the Twilio case covers provider failures, mismatched numbers, incorrect/expired codes, attempt limits, application-instance recreation, replay, consent/version gates, signed form tampering, account/service/number mismatches, STOP/HELP/START, duplicate inbound events, unknown outbound messages, terminal-state preservation, RLS and denied client RPC access. Browser acceptance and reload passed through the existing invitation UI using the offline SDK adapter. Screenshot: `test-results/twilio-local-acceptance.png` (ignored test artifact).

Still required before production: persistent shared phone/IP/account throttling and abuse controls; production consent evidence and suppression integration; queue/dispatch cancellation and final suppression checks; reply ownership/routing; approved real Verify service and credentials; real provider tests; approved endpoint deployment; and Twilio campaign readiness. Local simulated STOP does not modify the hosted database or Twilio's block list.

## Prepared verification configuration (not installed)

Use a separate Verify service named `CareText`, with its own `VA...` SID; the existing `MG...` Messaging Service SID is not a Verify Service SID. Keep the application simulator separate and never promote its evidence to real consent.

- Proposed code length: six digits. Obtain actual provider validity from service settings; do not promise the simulator's five-minute expiry matches the provider default.
- Keep Fraud Guard enabled, restrict destinations to the approved launch geography, and apply durable per-invitation, phone, IP and account rate limits plus resend cooldowns. Do not bypass fraud checks with Safe List or RiskCheck overrides.
- Request a code only after the recipient explicitly requests phone verification; disclose that this separate verification SMS may precede recurring-message enrollment.
- Check verification on the server. Require provider status `approved`, the bound invited phone and invitation, current disclosure version, affirmative checkbox, valid invitation and no suppression before recording production consent atomically. Verification alone is not recurring-message consent.
- Test expired/replayed/wrong codes, changed numbers, duplicate callbacks, rate limits, revocation, and opt-out before any live workflow. Current implementation is only the local simulator.
- Future server-only configuration: `TWILIO_ACCOUNT_SID`, `TWILIO_VERIFY_SERVICE_SID`, approved API credentials, and webhook validation auth token. No secrets in HTML, public build configuration, logs or Git. No credentials were retrieved during this inspection.

## Prepared webhook configuration (not installed)

Proposed routes below now have locally tested handler logic, but are **not deployed or active endpoints**. Do not enter them in Twilio until backend tests pass and the owner approves the exact public endpoint scope.

| Setting | Proposed value |
| --- | --- |
| Messaging Service inbound handling | Send a webhook |
| Inbound method / URL | POST `https://caretext.app/api/twilio/inbound` |
| Delivery status callback | `https://caretext.app/api/twilio/status` |
| Backup handler | Leave unset until a separately tested fallback exists |

Validate `X-Twilio-Signature` with the official SDK against the exact externally visible HTTPS URL and all supplied parameters before any mutation. Reject invalid signatures and unexpected AccountSid/number/service context. Bind callbacks to known message records; handle retries idempotently and prevent stale status events from reversing terminal state. Do not log message bodies, OTPs, full numbers or credentials unnecessarily.

Inbound handlers should persist replies and suppression transactionally, returning empty TwiML rather than sending application replies while sending is disabled. Before launch, configure and test Advanced Opt-Out and `OptOutType` handling. Suppress immediately on STOP, cancel queued sends, and recheck suppression before dispatch. START must not bypass CareText's verified affirmative-consent requirements. Avoid duplicate application replies when Twilio already handles keyword responses.

Proposed branded HELP text for later approval: “CareText by CyBase Risk Management, LLC: Help at support@caretext.app. Message frequency varies. Msg & data rates may apply. Reply STOP to unsubscribe.” Keyword-response changes can cause automatic SMS replies; none were enabled or changed here.

## Approval and release gates

1. Complete production integration, shared abuse throttling, production consent/suppression, queue enforcement and reply routing. Offline provider/signature/STOP/HELP tests are complete; production integration remains blocked.
2. Create the CareText Verify service and provision narrowly scoped server credentials through an approved secret-storage workflow; never send credentials in chat.
3. Obtain explicit approval for limited real verification SMS tests, including destination and spend limit. The current no-live-SMS instruction includes OTP tests.
4. Obtain approval for the exact deployment scope before exposing endpoints or review pages. Keep public registration, payments and customer SMS disabled separately.
5. Complete truthful campaign evidence, campaign approval and sender registration before recurring delivery. Number assignment alone is not launch readiness.

The existing Netlify build block remains `node scripts/deployment-disabled.mjs`. This document adds no executable sending path and changes no external settings.

## Official references

- [Verify API](https://www.twilio.com/docs/verify/api)
- [Verify Fraud Guard](https://www.twilio.com/docs/verify/preventing-toll-fraud/sms-fraud-guard)
- [Secure webhooks](https://www.twilio.com/docs/usage/webhooks/webhooks-security)
- [Incoming message webhook parameters](https://www.twilio.com/docs/messaging/guides/webhook-request)
- [Advanced Opt-Out](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out)

## Owner approval update and first real verification test

The owner has approved preparing real SMS tests and public webhook deployment in principle, while also explicitly directing that live SMS and public deployment remain disabled. No activation follows from this update. The precise test destination, spending cap, and deployment exception still need to be specified.

Before the first real Verify SMS:

1. Obtain a phone number controlled by the tester (E.164 format), an explicit maximum total spend in USD, and a maximum number of code sends. The existing CareText sender number is not assumed to be the recipient.
2. Create the CareText-only Verify service, retain Fraud Guard, review destination permissions, and install narrowly scoped server credentials through secret storage. Do not paste credentials into chat.
3. Implement a separately gated real provider transport: the committed adapter deliberately supports offline transport only. Enforce a destination allowlist, send-count/budget controls, durable shared throttling, and a kill switch. Keep recurring CareTouch delivery and payments disabled.
4. Agree on the test evidence: requested code arrives, correct code succeeds, incorrect/expired/replayed codes fail, verification remains bound to the invited number, and no production recurring-message consent or delivery is activated.
5. A local server can initiate and check Verify through outbound API requests; public inbound/status webhooks are not required for this first OTP check. If webhooks are deployed later, obtain the exact approved endpoint/hosting scope as an explicit exception to the current deployment block, with registration and the rest of the website still gated.
6. After the bounded test, disable its sending gate and report number of attempts, outcome and actual provider charges when available. Never log or commit OTPs, credentials or full recipient details.

No Twilio Console settings, hosted database migration, public deployment, SMS send or charge was performed as part of the commit/push request.
