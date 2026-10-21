# CareText email activation checklist

Domain: `caretext.app`. Sender: `CareText <notifications@caretext.app>`.
Provider: existing cybaserisk Resend account; separate CareText domain and credentials. CyFireAI configuration is not used or changed.

Resend domain ID: `2fe82f93-f513-488a-8acc-ffdfae8d0c2c` (North Virginia).
The domain is verified in Resend as of October 20, 2026, 8:53 PM America/Chicago. All four records below were added to the CareText Cloudflare zone. Both CNAMEs are DNS only. The owner-approved `CareText Supabase Auth` sending key is restricted to caretext.app and installed as Supabase's SMTP password. Its temporary local copy was removed. Actual inbox delivery and user completion of verification/recovery remain pending.

## Exact DNS records supplied by Resend

Add these to the **caretext.app** zone only. TTL Auto. CNAME records must be DNS only (grey cloud), not proxied. These are the records actually issued by Resend for this domain; do not substitute generic legacy SPF/MX examples.

| Type | Name | Value | Proxy |
| --- | --- | --- | --- |
| TXT | `resend._domainkey` | See complete DKIM value below | N/A |
| CNAME | `rsend` | `rsend.forge.rmta.net` | DNS only |
| CNAME | `send` | `send.forge.rmta.net` | DNS only |
| TXT (optional, recommended initial monitoring policy) | `_dmarc` | `v=DMARC1; p=none;` | N/A |

Complete DKIM TXT value (one record, one uninterrupted value):

```text
p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDkM/jTxTy6+GzPWfr8cHbHCu/SimbUKSyQDXrQKqtYL4VZxnML/oVsnPYPBscVC81eGXfCzvkKN02192zmHWYt7fAAmGV43uH947udCKV5rzwGmeskIa3nwe2Wy0727oSf9ySm9pMkiViIZ4hGis/BRjtz1V26bAydF+7Nd3ibEwIDAQAB
```

Preserve existing MX and SPF records used by other mail services. If a DMARC record already exists, review and update the single existing policy rather than adding a second one. Inbound email receiving in Resend remains off; sending notifications does not require changing root MX records.

After adding DNS, click “I've already added the records” in [Resend domain setup](https://resend.com/domains/add/2fe82f93-f513-488a-8acc-ffdfae8d0c2c) and wait for Verified. Keep click/open tracking off for authentication links.

## Separate credentials and service configuration

Create a Resend key named `CareText Supabase Auth`, with Sending access limited to `caretext.app`. Store it only as Supabase's SMTP password. Never reuse the CyFireAI key. Supabase SMTP: host `smtp.resend.com`, port `465`, username `resend`, sender name `CareText`, sender email `notifications@caretext.app`.

For later Netlify transactional notifications, create another CareText-only sending key named `CareText Netlify Notifications`. Store it as a secret named `CARETEXT_RESEND_API_KEY` in the CareText Netlify project, scoped to Functions, with `CARETEXT_EMAIL_FROM=CareText <notifications@caretext.app>`. Do not put it in Builds, browser configuration, Git, or CyFireAI's project. Email workers for approval reminders, recipient reply notifications, and subscription notifications are future server-only features and remain disabled until the relevant workflows exist. No public generic send-email endpoint should be added.

SMTP is enabled for private authentication testing. The owner confirmed receipt of the signup confirmation email at the approved inbox on October 20, 2026. Completion of the emailed confirmation link and recovery delivery remain to be verified. No test mail goes to customers. The approved test inbox is managed outside this repository in a private signup allowlist. The separate Netlify notifications key and workers have not been created or enabled.

## URLs and registration gate

Supabase Site URL is `https://caretext.app`. Exact allowed redirects are `https://caretext.app/account.html` and `http://localhost:4173/account.html` for private local testing. No wildcard redirect is allowed. The before-user-created hook rejects addresses outside the private tester allowlist, even if someone bypasses the website and calls Supabase directly.

At inspection, `caretext.app` had Cloudflare nameservers but no website A record. DNS/TLS and a private approved test deployment are still required before production-domain browser tests can pass. The repository's Netlify deployment block remains enabled. Do not route public traffic to new account screens or activate open registration as part of email-domain verification.
