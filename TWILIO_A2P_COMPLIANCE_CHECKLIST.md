# CareText Twilio A2P 10DLC Compliance Checklist

Assessment: October 20, 2026 (America/Chicago). **NOT READY FOR SUBMISSION.** Content is prepared locally; no deployment or campaign submission is authorized or performed. No public registration, payments, or live SMS is enabled.

Brand/SMS program: CareText. Legal operator/business name: CyBase Risk Management, LLC. Website: https://caretext.app. Transactional sender: notifications@caretext.app (outbound auth delivery verified; not evidence of an inbound support mailbox).

| Requirement | Location / evidence | Submission status |
| --- | --- | --- |
| Twilio sender association | Console sender pool; TWILIO_SETUP.md | VERIFIED: +14246672273 belongs to MG444fa12ec1f01b8d68a82f0432dcf62e; number messaging disabled pending A2P registration |
| Verify service / webhooks | TWILIO_SETUP.md | CareText Verify service created and controlled real OTP test passed; test sending gate closed. BLOCKED: number webhooks and service status callback blank; Advanced Opt-Out not enabled |
| Consistent brand and operator | All three pages, site footers | Content ready |
| Privacy URL | `/privacy`, `site/privacy/index.html` | Local route verified; public HTTPS pending approval |
| Terms URL | `/terms`, `site/terms/index.html` | Local route verified; public HTTPS pending approval |
| Invitation URL | `/invite`, `site/invite/index.html` | Production integration tested locally with mocked provider; standalone real OTP test passed separately. Hosted integration and public route pending |
| Collection, use, storage and deletion | Privacy: information, storage, LearnMe sections | Current behavior described; final retention policy unresolved |
| No mobile/SMS consent marketing sharing | Privacy: Mobile information and service providers | Explicit no sale, rental, or sharing with third parties/affiliates for marketing/promotions |
| Necessary provider processing | Privacy: providers and current/planned services | Disclosed; final provider contracts/settings need validation |
| LearnMe control and deletion | Privacy; applied opt-out migration; AUTH_ACCEPTANCE.md | Active-database deletion verified; provider backups not independently purged |
| Privacy-request procedure | Privacy: Privacy requests | Basic identity-verification instructions prepared; owner supplied 5-business-day acknowledgment / 30-calendar-day response targets; inbound delivery verified; staffing coverage, request tracking and legal-rights process still require validation |
| Verified privacy address | privacy@caretext.app | PASS: Zoho-to-Cloudflare-to-Gmail receipt verified October 20, 2026; owner-designated monitored destination; automatic Privacy labeling configured |
| Verified support address | support@caretext.app | PASS: Zoho-to-Cloudflare-to-Gmail receipt verified October 20, 2026; owner-designated monitored destination; automatic Support labeling configured |
| Retention periods / backup deletion | Privacy: Storage, retention, and deletion | BLOCKED: owner supplied category-specific periods; no scheduled deletion or verified provider backup lifecycle. No Texas statutory-retention claim made |
| Free/Essential/Plus terms | Terms: Subscriptions | Content prepared; billing inactive. Confirm final annual checkout prices and SMS segment accounting before launch |
| Recurring billing / cancellation | Terms: Renewals, cancellation and refunds | Described conditionally; portal and webhook behavior unimplemented |
| Refund windows | Terms: 7 days initial monthly / 14 days initial annual purchase | Content ready; applicable law and service exceptions retained; processing workflow pending |
| Recipient replacements | Terms; production consent migration | Rolling 30-day voluntary limit and recorded opt-out exception tested locally for paid plans; other documented exceptions require support handling; hosted enforcement pending |
| SMS program / AI transparency | Terms and invitation | Content ready; human approval and future Autopilot distinguished; Autopilot disabled |
| Frequency / rates / STOP / HELP | Terms and invitation | General disclosures present; actual per-invitation schedule and configured keyword behavior pending |
| Carrier liability disclaimer | Terms: Delivery and privacy | Content ready |
| Subscriber identity | Invitation: From | Production server snapshots saved subscriber display name; local UI and ownership checks implemented; hosted acceptance pending |
| Expected message frequency | Invitation: Frequency | Server schedule snapshot displayed; changed setup invalidates invitation; production entitlement checks tested locally; hosted acceptance pending |
| Separate unchecked SMS checkbox | Invitation | Present, unchecked and separate; required for test acceptance; no live consent |
| Accept / Decline | Invitation and flow.js | Test Accept requires challenge and affirmative action; Decline records decline without granting consent; no-token page fails closed |
| Affirmative action + verification before recording consent | Production service and service-role-only RPC | LOCAL TESTS PASS: bound provider approval, affirmative/version checks, expiration, replay prevention and atomic activation. Hosted migration, endpoint mounting and approved real end-to-end acceptance remain pending |
| Consent evidence | Production consent migration | Immutable production evidence includes recipient/sender/relationship IDs, disclosure/version, frequency, timestamp and provider context; tested locally with mocked provider. No live production consent granted |
| STOP / HELP / reply handling | Production service and migration | LOCAL TESTS PASS: signed STOP suppression/queue cancellation, HELP preview, START non-reactivation, sender-isolated replies and multi-sender quarantine. BLOCKED: hosted integration, provider keywords, actual responses and future dispatch |
| Reviewer-accessible proof | These pages / future evidence | BLOCKED: no public approved deployment or approved evidence URL; static preview must not be presented as functional consent |
| Brand and campaign data | Twilio submission | Business identity/EIN/contact, registered brand match, campaign use case, message samples, number association and complete message-flow description not reviewed/submitted |
| Safe public review scope | netlify.toml; deployment-disabled.mjs | Deployment block retained. Owner approval required for exact reviewed scope |

## Required owner input and deployment approval

1. Retention periods and privacy-request procedure have now been supplied. Validate each period against actual provider controls before promising it. Identify treatment of consent/suppression evidence, provider logs and backups.
2. Inbound privacy and support delivery is verified. Finalize response coverage, request tracking, escalation and an approved reply identity; receipt testing alone does not validate these procedures.
3. Approve final policy text and operational procedures after missing facts are resolved. No effective date has been invented.
4. Production consent is implemented locally; hosted and separately approved real end-to-end acceptance remain pending. Operational deletion still requires implementation and validation.
5. Proposed future deployment scope for approval: only `/privacy`, `/terms`, `/invite`, their necessary CSS/logo/preview assets, and reviewed legal footer links. No public account/onboarding routes, checkout, SMS endpoints or registration changes. Hosting must enforce that restricted scope; copying the entire current dist directory would exceed it. Domain routing/TLS and any replacement of existing hosted content must be reviewed explicitly before deployment.

## Authoritative review references

- [Twilio campaign onboarding guide](https://help.twilio.com/articles/11847054539547): disclosure and review requirements.
- [Twilio error 30932](https://www.twilio.com/docs/api/errors/30932): mobile opt-in data and consent non-sharing disclosure.
- [Twilio error 30917](https://www.twilio.com/docs/api/errors/30917): complete descriptions for every consent method.
- [Twilio required business information](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/collect-business-info): brand/campaign details and reviewer evidence.
- [Twilio registration quickstart](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/quickstart): registration process and development-flow evidence options.

This checklist reports implementation and evidence status, not legal certification or a guarantee of carrier approval.

## Provider and inbound-email follow-up

See [PROVIDER_RETENTION_REVIEW.md](PROVIDER_RETENTION_REVIEW.md) and [CARETEXT_INBOUND_EMAIL_PLAN.md](CARETEXT_INBOUND_EMAIL_PLAN.md). Owner-approved Cloudflare routing is configured: privacy@caretext.app and support@caretext.app are Active and forward to the verified destination cybaserisk@gmail.com. Routing MX records resolve and existing Resend records are preserved. Both external Zoho-to-CareText-to-Gmail delivery tests passed on October 20, 2026. Both messages appeared in the destination Inbox. Requested CareText / Privacy and CareText / Support labels were created. Inbound addresses are operational. The owner identifies Gmail as monitored, but response coverage and request handling still require operational confirmation.



Gmail filters: `to:(privacy@caretext.app)` applies `CareText / Privacy`; `to:(support@caretext.app)` applies `CareText / Support`. Both also applied to the existing matching test conversation. No archive, delete, mark-read, forwarding or spam-bypass actions were selected.

See [RECIPIENT_INVITATION_TESTING.md](RECIPIENT_INVITATION_TESTING.md) for implementation, test evidence, safe local operation and remaining approvals. The invitation simulator does not prove phone ownership or grant production SMS consent; the separate controlled real Verify test is documented below.

## Controlled Verify test follow-up

A dedicated CareText Verify service now exists. The approved local-only test passed with two OTP sends, including actual code approval and provider expiration; the sending gate is now closed. See `TWILIO_VERIFY_TEST_REPORT.md`. This validates the restricted OTP test adapter, not the production invitation-to-consent-to-delivery workflow. Public webhooks, production consent/suppression integration, campaign approval and reviewer-accessible deployment remain blockers. Submission readiness remains NOT READY.

## Production consent implementation

Production invitation/Verify orchestration, immutable consent evidence, entitlement-checked activation, signed STOP/HELP persistence and safe reply routing are implemented and tested locally. The new migration and endpoints are not deployed; paid verification and delivery remain disabled. See [PRODUCTION_CONSENT_DEPLOYMENT.md](PRODUCTION_CONSENT_DEPLOYMENT.md) for the verification report, exact proposed public scope and remaining campaign/operational blockers. The controlled-test sending gate remains closed.
