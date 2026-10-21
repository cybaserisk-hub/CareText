# Leaked-password protection review

Read-only hosted security advisor still reports `auth_leaked_password_protection` WARN for CareText. No Auth setting was changed. Minimum password length remains 12 and public registration remains gated by the existing allowlist hook.

Required setting: enable **Prevent use of leaked passwords / Leaked password protection** in the project's Auth password-security settings. The documented Management API field is `password_hibp_enabled: true`. A future approved change should patch ONLY that field on CareText, not push broad Auth configuration or touch CyFireAI. Do not put provider credentials in a patch file or commit a full Auth config response.

Supabase documents availability on **Pro and above**. Its published pricing currently starts at **$25/month for Pro**, with additional projects/compute/usage potentially adding cost. There is no separate per-check fee listed for this setting in the reviewed sources; that is not an account-specific quote. Current account-specific dashboard verification: organization **CareText App**, one project, **Free plan**. The Email provider panel identifies leaked-password protection as Pro+ and currently off. The billing page lists Pro from **$25/month**; backups page confirms Free has no project backups. No upgrade or Auth change was made. The owner authorized a no-cost change only, so that condition is not met. Usage/compute may add costs and billing must be rechecked before any upgrade. Do not upgrade the organization or purchase anything without an explicit cost approval, particularly if other apps share billing.

## Approval and verification

1. Confirm CareText organization plan and feature entitlement read-only; obtain an actual account quote if an upgrade is necessary. Owner has approved enabling the setting only when included at no added cost; a paid plan/compute increase still requires separate approval.
2. Capture the current value without exporting SMTP/secrets; apply only the approved field. Keep registration, SMTP, redirects, allowlist and all other settings unchanged.
3. Re-read the flag and repeat security advisors. Using a separately approved isolated Auth tester, check rejected known-compromised test password, accepted strong unique password, signup/reset/change error UX and existing-user behavior. Never log a password or send real user secrets to a third-party test website.
4. Password security is not a forced reset of all existing passwords. Verify existing-login behavior and remediation messaging; do not lock out or reset customers as an unrequested side effect.
5. If configuration causes a regression, keep public registration closed and fix the error handling; do not quietly weaken protection. Any emergency reversal requires a reviewed owner decision.

Sources: [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [Auth configuration field](https://supabase.com/docs/reference/api/v1-update-auth-service-config), [published pricing](https://supabase.com/pricing). Price/availability must be rechecked at approval time.
