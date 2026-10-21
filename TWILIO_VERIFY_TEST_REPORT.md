# Controlled CareText Verify test report

Status: **FUNCTIONAL TEST COMPLETE — PASS. Sending gate permanently closed for this test; final billing pending.** October 20, 2026 (America/Chicago).

## Authorized scope

One owner-approved recipient, maximum five OTP sends across the entire test, maximum USD 5 total. The recipient is deliberately omitted from this report and source code. No public endpoints, public deployment, registration, CareTouch delivery, Trusted Autopilot or Polar payments are enabled.

## Configuration completed

- Dedicated CareText Verify service created; six-digit codes, default template, Fraud Guard Standard enabled.
- Optional carrier lookup is disabled. Voice, email and WhatsApp channels are disabled.
- Twilio automatically supports RCS upgrades as part of Verify SMS; these are billed as SMS, not an additional paid service. The first observed attempt used SMS.
- Existing account credentials are encrypted with RSA-OAEP; the private key is Windows DPAPI-protected. Vault and ledger are under the current user's LocalAppData/CareText directory, outside Git and OneDrive. NTFS access is restricted to the current Windows user and SYSTEM. No credential is embedded in browser code or emitted in application logs.
- The dedicated local runner uses the existing account credential, which is broader than a restricted API key. Application restrictions do not change that credential's account-level permissions. Do not reuse this test runner as a production credential design.

## Controls

The runner binds only 127.0.0.1:4175, validates Host and Origin, requires a per-process CSRF token, and serializes browser operations. The destination is read only from encrypted configuration and must match the approved number's SHA-256 digest. There is no destination input or general SMS API.

SQLite reserves USD 1 before each send, with an absolute five-reservation / USD 5 admission limit. Reservations are never refunded for failed or uncertain attempts. Transactions prevent concurrent requests from bypassing limits. Restarting does not reset counters. Initialization refuses to overwrite an existing test. Uncertain provider results stop the test. SDK automatic retries are disabled.

This is a conservative application budget reservation, not a Twilio account-level billing cap. Twilio's published US rate at review was USD 0.0083 per SMS plus USD 0.05 per successful verification, excluding any applicable extra carrier/tax charges. Five single-segment successful attempts would have a published base cost of USD 0.2915. The USD 1 reservation per send provides substantial headroom. Actual final billing can be delayed; do not report reserved money as money charged.

## Final functional results

| Check | Result |
| --- | --- |
| Local automated suite | PASS: 8 tests |
| Exact recipient restriction | PASS with synthetic unit tests |
| Concurrent requests / five-send / budget admission limits | PASS with synthetic unit tests; no paid messages used to exhaust limits |
| Limits persist across restarts | PASS with synthetic unit tests |
| Failed/uncertain send consumes reservation and stops test | PASS with synthetic unit test |
| First real provider send | PASS: first verification approved; second verification expired |
| Immediate resend rate limit | PASS: blocked locally, no second provider call |
| Arrival | PASS: confirmed by tester |
| Incorrect real code | PASS: derived incorrect code rejected by provider |
| Correct real code | PASS: provider returned approved and valid |
| Local replay prevention against the real verification | PASS: completed verification rejected locally without another provider check |
| Real provider expiration | PASS: provider expiration recorded; second attempt terminal status expired, one expiration check |
| Twilio final charge | Pending: both provider attempt prices remain null; one converted and one unconverted attempt |

Final test usage: **2 of 5 sends used, USD 2 reserved, final billed total unknown.** Further sends are blocked by the persisted closed flag; a fresh adapter instance was tested and rejected a send before contacting Twilio. First verification consumed two provider checks (incorrect then correct); local cooldown and replay checks made no extra provider calls. The second attempt consumed one expiration check. Total: two sends and three provider verification checks. The published base-cost estimate is USD 0.0666 (two SMS plus one successful verification), before any applicable additional charges; this is not a finalized invoice amount.

## Test closure and remaining work

The persisted test gate is closed. Do not reset or delete the ledger or run initialization again. Restarting the local runner will not reopen sending. The read-only audit remains `node scripts/audit-controlled-verify.mjs`; it does not send messages. Final provider charges can be reconciled after they become available.

All requested functional cases passed within two sends. The five-send/budget exhaustion and concurrency cases were tested using mocks, not additional paid messages. Replay prevention was enforced locally before a second provider request; no claim is made that a separate direct-to-provider replay test was performed.

The credentials remain encrypted outside the repository. They are available only to the local Windows user and SYSTEM; the test itself uses an existing account token rather than a newly scoped production key. Production still requires its own least-privilege credential design, hosted consent/suppression integration, shared abuse controls, campaign readiness and separately approved deployment. This test grants no recurring SMS consent and activates no CareTouch relationship.

The controlled-test implementation and this report are included in the owner-requested GitHub update. Encrypted credentials, the private ledger, and screenshot artifacts are excluded from source control.

## References

- [Verify pricing](https://www.twilio.com/en-us/verify/pricing)
- [Default verification timeout](https://www.twilio.com/docs/verify/api/rate-limits-and-timeouts)
- [RCS upgrade and billing](https://www.twilio.com/docs/verify/rcs)
- [Attempt pricing may take up to 24 hours to finalize](https://www.twilio.com/docs/verify/api/attempts)
