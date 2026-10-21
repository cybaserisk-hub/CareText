# CareText authentication acceptance

## Verified

- Signup email delivered through the domain-restricted CareText Resend key to the approved owner inbox.
- Owner opened the confirmation link and reached My account.
- Password recovery request accepted; Resend reports Delivered.
- Hosted API checks passed for unconfirmed login denial, confirmation, password login, refresh, recovery, token single use, password change, and logout refresh revocation.
- Hosted ownership checks deny cross-account access and forged consent, paid entitlement, and activation.
- Local PostgreSQL tests cover onboarding persistence, stale revisions, LearnMe opt-in/out cleanup, and private signup gating.
- In-app browser checks passed for generated confirmation links, recipient save/reload, and logout. Password visibility toggles work in the browser.

## Pending acceptance

- Owner confirmed emailed recovery, new password login, and rejection of the old password. This acceptance check is complete.
- In-app browser onboarding passed MyTouch, CareTouch preference, recipient details, personalization, schedule save/reload, and stale-tab conflict rejection. A 390×844 viewport passed recipient edit/save/reload. This is responsive viewport testing, not a physical-device or Safari engine pass.
- A direct database inspection caught retained LearnMe examples after opt-out. Migration `20261021021112_learnme_optout_deletion.sql` fixes SELECT visibility needed by the invoker DELETE. A fresh opt-in/sample/opt-out browser test verified zero stored examples, no subscription, and inactive CareTouch. The local regression now checks rows with RLS bypassed so hidden data cannot falsely pass.
- Supabase advisor reports leaked-password protection disabled. Review availability and enable before production acceptance.
- Earlier standalone automated browser runs were incomplete; do not treat them as passing. Remaining browser coverage includes Safari and physical devices.
- Physical phone checks below require a private HTTPS test deployment. Localhost on a phone refers to the phone, not this development computer. Public deployment remains blocked.

## Physical iPhone / Android procedure

Use Safari on iPhone or Chrome on Android, the approved test account, and a private HTTPS test URL once available.

1. Request a confirmation or recovery email from that test site. Open the newest link in the phone's mail app and confirm it reaches the correct browser and account screen.
2. For recovery, enter a new password, use the eye button in both states, and save. Reload, sign out, and sign in again. Verify the old password fails.
3. Open onboarding. Enter a clearly named test recipient; check the keyboard does not obscure inputs or Save setup. Select MyTouch, change personalization and schedule, save, and reload.
4. Select a paid plan and CareTouch as preferences. Save and reload; current entitlement remains Free and delivery stays inactive. No payment or SMS should occur.
5. Opt in to LearnMe, add a harmless sample, save, and reload. Opt out and save; reload and ensure examples are gone.
6. Background the browser, return, and check saved data. Rotate the phone and check controls remain usable. Sign out, then use Back and reload; account data must not be accessible.

Email-app handoff, mobile password-manager/autofill behavior, software keyboards, and background/resume behavior require a physical-device pass; viewport emulation alone cannot establish these.

Polar integration remains gated on completion of authentication and onboarding acceptance. Payments, SMS, public registration, and public deployment remain disabled.
