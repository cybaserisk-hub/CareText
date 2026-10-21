# CareText inbound email — configured; inbound delivery verified

Use Cloudflare Email Routing for privacy@caretext.app and support@caretext.app. Both active rules forward to cybaserisk@gmail.com, the owner-specified monitored destination. Cloudflare shows this destination as Verified. Continue Resend outbound mail from notifications@caretext.app. Do not alter CyFireAI's domains, routing or credentials.

## Compatibility and current evidence

[Cloudflare Email Routing](https://developers.cloudflare.com/email-service/get-started/route-emails/) uses root-domain MX records and its prescribed TXT/SPF configuration. [Cloudflare domain configuration](https://developers.cloudflare.com/email-service/configuration/domains/) distinguishes routing and sending records. It can coexist with Resend's existing records on different names:

- TXT `resend._domainkey` — preserve exact DKIM value.
- CNAME `send` to `send.forge.rmta.net` — DNS only.
- CNAME `rsend` to `rsend.forge.rmta.net` — DNS only.
- TXT `_dmarc` with `v=DMARC1; p=none;` — preserve pending a separate policy review.

On October 20, 2026, the owner explicitly approved CareText-only DNS changes. Cloudflare activated its routing DNS and both rules; public DNS queries against 1.1.1.1 confirm the new MX records. Resend inbound receiving remains off; do not enable competing root MX routing. Forwarding is not an outbound SMTP mailbox: replies as privacy/support require a separately configured sending identity or an approved response workflow.

## Configuration runbook (remaining operational steps noted below)

1. Inspect and export the **caretext.app** zone. Confirm no conflicting MX or root SPF records have appeared. Do not modify cyfire.ai.
2. Open CareText's Email Routing setup. Add the exact destination inbox; the owner completes its verification email. Verification demonstrates control, not ongoing monitoring.
3. Prepare named routes for `privacy` and `support` to that destination. Keep catch-all disabled unless separately approved.
4. Review the MX priorities/targets and TXT records **issued by Cloudflare for this setup** with the owner. Do not guess them from old examples. Add only after approval. Preserve the four Resend records above. If root SPF already exists, merge authorized mechanisms into one valid SPF policy rather than creating duplicate SPF records; review DNS-lookup limits.
5. Enable the two approved routes after DNS verification. Do not enable Resend inbound on the same root domain or change public website routing.
6. Configure the receiving mailbox/team assignment, spam handling, labels and access permissions. Establish a named monitoring owner and backup, response schedule, and escalation/appeal handling.

## Required acceptance tests

1. From an external address different from the forwarding destination, send separate non-sensitive test messages with unique subjects to privacy@caretext.app and support@caretext.app. Use no real privacy-request data.
2. Confirm each message appears in Cloudflare routing activity and arrives in the intended destination (including spam-folder inspection). Record timestamp, route, subject identifier and human receipt confirmation; avoid storing message bodies or authentication headers unnecessarily.
3. Test a support reply and return response. Confirm the approved From/Reply-To identity works and no unexpected personal mailbox address is exposed. Forwarding alone does not prove this.
4. Trigger one owner-authorized CareText auth email via Supabase/Resend. Verify delivery and SPF/DKIM/DMARC results to establish outbound mail was not disrupted.
5. Confirm neither route forwards to CyFireAI destinations unintentionally; no catch-all or loop was enabled.
6. Only mark **inbound operational** after both addresses pass delivery tests. Only mark **monitored** after the responsible person confirms ownership and coverage. Update policy/checklist evidence then.

The owner authorized and we applied only CareText routing DNS changes. Public deployment, public customer registration, payments and SMS remain disabled. Both inbound delivery tests passed and both requested Gmail labels were created.

## Applied DNS and verification evidence

- MX @ priority 2: route1.mx.cloudflare.net.
- MX @ priority 36: route2.mx.cloudflare.net.
- MX @ priority 7: route3.mx.cloudflare.net.
- TXT @: v=spf1 include:_spf.mx.cloudflare.net ~all
- TXT cf2024-1._domainkey: Cloudflare-issued DKIM public key.
- Both named rules show Active; catch-all remains Disabled (Drop).
- Resend send/rsend CNAMEs, resend._domainkey TXT and _dmarc TXT still resolve with their existing values. Notifications remains outbound through Resend; no CyFireAI configuration was changed.
- Evidence screenshot: test-results/cloudflare-caretext-routing.png (local, ignored by Git).

## Delivery test results — October 20, 2026

Both messages were sent from angel@cybaserisk.com using the signed-in Zoho Mail browser. Zoho displayed Mail sent for each. Both were observed in the cybaserisk@gmail.com Gmail Inbox at 10:05 PM (Gmail display time), not merely in a sender Sent folder:

- privacy@caretext.app: CareText routing test PRIVACY-20261020-A — PASS. Gmail details confirm original To privacy@caretext.app, mailed-by caretext.app, signed-by cybaserisk.com, TLS.
- support@caretext.app: CareText routing test SUPPORT-20261020-A — PASS. Separate unique test message visible in the destination Inbox.

Created the exact Gmail labels CareText / Privacy and CareText / Support after receipt. Recipient-based automatic labeling filters are configured for both addresses, and applied to the existing test conversations. Only the appropriate label action is enabled; Inbox delivery and spam protections are unchanged. Evidence: test-results/caretext-gmail-filters.png (local, Git-ignored).

Inbound delivery is operational. The owner identifies the destination as monitored; staffing coverage, escalation, request tracking and replies from CareText identities remain operational follow-up. Forwarding alone does not configure a CareText From address. Existing Resend DNS was verified unchanged; a new end-to-end outbound Resend test was not performed in this routing test. No public deployment, public registration, payments or SMS was enabled.
