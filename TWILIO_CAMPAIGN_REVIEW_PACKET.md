# CareText A2P 10DLC review packet

**DRAFT FOR OWNER REVIEW — NOT SUBMITTED.** Intended launch behavior below is conditional on hosted validation, endpoint approval and independent messaging authorization. No claim is made that the production flow is currently public or live.

## Identity and classification

- Customer-facing/SMS brand: CareText. Legal operator: CyBase Risk Management, LLC.
- Required destination URLs remain `https://caretext.app/privacy`, `https://caretext.app/terms`, `https://caretext.app/invite`.
- Privacy: privacy@caretext.app. Support: support@caretext.app. Both previously verified inbound to the owner-designated monitored mailbox. Outbound transactional identity: notifications@caretext.app; not an inbound support inbox.
- Previously reported brand: approved Low Volume Standard; no registered campaign in the last confirmed account review. Recheck the brand/business identity and current campaign state before submission.
- Proposed classification for review: LOW_VOLUME if offered for this brand. Obtain Twilio confirmation that personal relationship messages delivered by this application fit the selected use case. These are A2P messages despite personal content. Do not select 2FA for the recurring-message campaign; dedicated Verify OTPs are a separate requested verification flow.
- Embedded URL/phone flags must match actual allowed outgoing content, including any enrollment/support messages. The examples below contain no URL or phone number. Do not answer “No” while allowing unrestricted subscriber text to insert them; decide and enforce that policy before submission/launch.

## Campaign description draft

CareText, operated by CyBase Risk Management, LLC, enables individual subscribers to send recipient-consented encouragement, appreciation and special-occasion SMS messages to loved ones. For standard CareTouch, subscribers review and approve AI-assisted messages before scheduled automatic delivery. Each recipient must independently opt in on a subscriber-specific web invitation and verify possession of the invited phone number. Message frequency follows the disclosed relationship schedule and plan limits. Recipients can reply STOP to opt out or HELP for support. The program does not send promotional marketing. Trusted Autopilot is a future feature, remains disabled, and is excluded from this campaign's initial operating scope.

## Message-flow draft

A signed-in CareText subscriber saves a recipient relationship and receives a unique invitation link to share personally. CareText does not automatically text an invitation or send recurring messages to an unconsented number. The recipient opens the web invitation at caretext.app/invite with an opaque token and sees the subscriber's name, expected message frequency, message purpose, legal operator, Privacy Policy and Terms links.

The invitation explains that standard CareTouch may use AI-assisted content reviewed and approved by the subscriber before scheduled automatic delivery. Trusted Autopilot is described as future and disabled, outside this invitation. The recipient confirms the invited phone number and explicitly requests a one-time verification code. That requested verification SMS is separate from permission for recurring messages. The recipient enters the code, independently selects the initially unchecked SMS consent checkbox, and clicks Accept & Verify. Decline is available without granting consent. A requested code, opening a link, or a subscriber entering a number never constitutes recurring SMS consent.

The server validates the provider's successful verification against the saved phone and challenge, checks the current disclosure and schedule, and records the recipient, subscriber and relationship IDs, disclosure version/text, frequency, server timestamp and provider verification evidence. It activates the relationship only when consent and plan requirements are satisfied. Message delivery remains independently gated. On withdrawal or STOP, consent is withdrawn and relevant delivery is suppressed; STOP suppresses the number across CareText sender relationships. HELP provides CareText support information. Ambiguous replies for a number shared across multiple sender relationships are withheld from subscribers pending a safe resolution process.

The page discloses recurring messages, variable frequency, message/data rates, STOP/HELP and that consent is not a condition of purchase. No marketing opt-in data is sold or shared. Before this description is submitted as the operational flow, complete the hosted acceptance and registration blockers in the checklist. Do not promise an SMS enrollment confirmation until it is implemented and separately authorized; the current implementation confirms acceptance on the web page only.

## Representative campaign samples

Square brackets denote variable content. These samples are proposed content, not sent messages. Every future send must include the CareText identity and approved relationship content; that dispatcher/template enforcement is not implemented yet.

1. `CareText from [subscriber name]: Thinking of you today. I hope you find a small moment of joy. Reply STOP to opt out or HELP for help.`
2. `CareText from [subscriber name]: Thank you for always making time for me. I appreciate you. Reply STOP to opt out or HELP for help.`
3. `CareText from [subscriber name]: Happy birthday! Wishing you a wonderful year ahead. Reply STOP to opt out or HELP for help.`

Frequency is not one message per day for every recipient. Invitations show the saved Weekly, Three times weekly, Monthly or eligible Plus Daily schedule. Essential allows 15 monthly SMS units for one recipient; Plus allows 100 across up to five; Free sends none. Actual encoded SMS segment accounting and batch-approval/scheduling enforcement are launch blockers. Preserve plan rules when implementing the dispatcher.

## Opt-in evidence package

- Source: `site/invite/index.html`, `site/invite/flow.js`, `src/invitation-service.mjs`, `src/production-consent.mjs`.
- Disclosure version: `caretext-sms-consent-v2`. Standard human approval and future disabled Autopilot are explicit. A future Autopilot launch needs a separately reviewed recipient disclosure/consent migration, not silent reinterpretation of this grant.
- Visual evidence: [desktop](docs/evidence/invitation-desktop.png), [mobile](docs/evidence/invitation-mobile.png); SHA-256 manifest at `docs/evidence/manifest.json`. Captured locally with a synthetic subscriber/schedule and mocked read-only view response. No OTP, phone number, credential, actual recipient, or production consent appears.
- Screenshots show the sender, schedule, operator, full disclosure, direct legal links, separate unchecked checkbox, Accept & Verify and Decline. The withdrawal control is hidden before acceptance; browser checks verify that visibility.
- Automated tests cover affirmative/provider checks, expiration, replay, unauthorized access, withdrawal and STOP/sender isolation. Controlled real OTP tests from the previous milestone validate Verify only, not hosted consent.
- The `/invite` shell without a token is intentionally not a live opt-in form. To submit gated-flow screenshots, confirm reviewer acceptance and provide them via an owner-approved evidence location. Do not invent a public screenshot URL or expose a valid customer token. Public Privacy/Terms access still requires deployment approval.

## Owner decisions before submission

Approve description, examples, selected use case and link/phone policy; confirm business/EIN/contact matches the approved brand; approve final legal language and retention/request procedures; choose acceptable public/gated opt-in evidence; approve exact hosting scope separately; resolve START/re-enrollment wording and behavior with Twilio; decide whether an enrollment SMS is required and implement it before claiming it. Campaign submission, fees and eventual sending each remain separately unauthorized.

References: [Twilio campaign fields and samples](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/collect-business-info), [registration quickstart](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/quickstart).
