# Advanced Opt-Out configuration and acceptance plan

**Prepared only. No Twilio settings changed, no SMS sent.** Scope is CareText's Messaging Service `MG444fa12ec1f01b8d68a82f0432dcf62e`; never change other product services. Reconfirm its sender pool before any approved edit. Verify's dedicated service is separate.

## Proposed settings, owner approval required

Use Messaging Service Advanced Opt-Out, English standard keyword handling, retaining required STOP behavior. Match the application's STOP synonyms: STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT, REVOKE, OPTOUT. HELP/INFO should map to HELP. Review existing country/language overrides; do not add unsupported languages or conflicting keywords silently. Provider defaults and available edits must be verified in Console before saving.

Proposed STOP response:

> CareText: You are unsubscribed from CareText messages. No further recurring messages will be sent. For help, contact support@caretext.app.

Proposed HELP response (matches the local response preview):

> CareText by CyBase Risk Management, LLC: Help at support@caretext.app. Message frequency varies. Msg & data rates may apply. Reply STOP to unsubscribe.

**START requires resolution before launch.** Twilio's START/UNSTOP (and potentially YES in configured keywords) may clear provider blocking. CareText deliberately does not restore application consent or remove its suppression on START. Do not use a confirmation saying recurring CareText messages have resumed. Proposed clarification for Twilio/owner review: “CareText: Your carrier-level block is removed. CareText messages remain paused until a new verified consent process is completed. Help: support@caretext.app.” A supported re-enrollment flow is not implemented; do not advertise one as available. This discrepancy must be resolved with approved wording and behavior before enabling Advanced Opt-Out for real traffic.

Eventually configure POST `https://caretext.app/api/twilio/inbound` only after that exact endpoint is approved and deployed. The handler uses the canonical external URL, official SDK signature validation, account/service/number context, bounded form parsing and deduplication. Do not use an untrusted forwarded Host to build the signing URL. Status callback configuration is separate and excluded until delivery scope is approved.

When Twilio supplies `OptOutType`, it has already handled the matching keyword response. CareText returns empty TwiML to avoid a second reply. Merely enabling Advanced Opt-Out can enable provider-generated replies; this is a messaging action requiring approval even though CareText has no sender. No configuration in this task enables it.

## Local automated tests completed

Signed STOP persists suppression across senders, withdraws consent, disables activation and cancels local queued entries. Invalid signatures do not mutate data; duplicate MessageSid is idempotent. HELP stores the approved preview and emits no Message TwiML. START does not reactivate. A unique eligible relationship receives an ordinary reply; multiple matches are quarantined with no subscriber disclosure. Paid OTP and actual provider keyword tests were not run in this milestone.

## Real acceptance procedure — blocked until separately approved

1. Owner supplies/renews a consenting test number, total budget, message/OTP count and time window, and separately approves public inbound scope plus provider replies. Prior controlled OTP permission is closed and cannot be reused.
2. Confirm no customer recipients, payments or Autopilot are involved; create isolated test relationships only under an approved procedure. Record redacted IDs and baseline state. Do not log phones, OTPs, tokens or reply bodies.
3. From the approved device send HELP. Confirm exactly one branded provider response, a valid signed HELP callback, a durable audit event and empty application TwiML. Record actual fees/counts; stop at the approved cap.
4. Send mixed-case STOP. Confirm one provider confirmation; application suppression across all test sender relationships; active flags false; queued local records canceled; delivery eligibility false. Retry the captured callback only in an authorized local fixture and verify no duplicate event. Do not send an extra paid message just to provoke provider error 21610 without separate budget approval.
5. Test remaining configured STOP synonyms locally first. Real additional keyword messages each consume the approved test allocation; only test those explicitly budgeted. Verify unrecognized reply text is not mistaken for consent.
6. If approved, send START and confirm provider behavior and approved wording. Assert application suppression persists and no relationship reactivates. Do not clear suppression manually to make the test pass.
7. With separately approved fixtures, check ordinary replies for one versus two active relationships. Two-sender ambiguity must remain private. This is not a public disambiguation UI; that remains future work.
8. Close all send gates, record redacted results/costs and remaining failures, and reconfirm production recipients never received messages. Keep failed cases blocked; do not submit campaign claims contradicted by test results.

Reference: [Twilio Advanced Opt-Out](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out). Provider configuration is independent of CareText's durable consent ledger; both must remain consistent before delivery is authorized.
