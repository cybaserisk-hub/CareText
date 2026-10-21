# CareText — Netlify Website & Interactive Onboarding v4

> Historical prototype notes below. Current build and account setup are documented in the root README.md and SUPABASE_SETUP.md; root README.md takes precedence for approved product rules. Build from the repository root and publish dist/, not this source directory. The new account.html is separate from the browser-only onboarding.

## What's included
- `index.html`: branded homepage with original CareText flyer photos and relationship icons, pricing, updated language, and a working onboarding entry point.
- `app.html`: interactive, responsive onboarding wizard, dashboard, message review, settings, and Trusted Autopilot control screen.
- `style.css`, `workspace.css`, `app.js`, `workspace.js`: static styling and front-end interactions.
- `assets/`: original flyer imagery.
- `architecture/db/001_autopilot.sql` and `architecture/src/eligibility.mjs`: **unconnected** server-side Autopilot schema/policy starter. Not automatically deployed.
- `netlify.toml`: static Netlify configuration.

## Test locally / Netlify
Unzip and drag the **contents** of this folder to Netlify Drop, or connect a GitHub repo with this directory as publish root. Open `index.html`, click Try Free or a plan, choose a mode and Learn Me setting, then Continue to Setup. Complete six onboarding stages. Use the profile icon for Settings and Autopilot. Data is stored in this browser's localStorage for demo purposes only.

## NOT production-ready
There is **no** authentication, payment, real AI generation, real reminders, consent verification, SMS delivery, or webhook integration. Do not collect real personal details or use this prototype as a live subscriber app. The prototype's sample message regeneration is not AI. Browser-local draft approval is not production authorization.

## Integration order
1. Supabase authentication, user/recipient/relationship schema, RLS, and encrypted sensitive data.
2. Polar product IDs, checkout, verified webhooks, subscription entitlements, monthly SMS allowance, annual pricing and renewal notice.
3. Twilio A2P approval, consent verification, inbound SMS, opt-outs, reply routing, status callbacks, and idempotent queued sends.
4. OpenAI generation via server functions with safety filters, limits, and Learn Me opt-in and deletion semantics.
5. Push/email notifications and reminder jobs.
6. Trusted Autopilot eligibility, recipient disclosure, pause/report, audit trails, per-relationship activation, and server-side enforcement. Do not expose activation based on browser state.

## Important product decisions
- Free: 1 loved one, 5 AI-generated texts per month, reminder-only, Copy & Send via your text app, no automated SMS.
- Essential: $4.99/month, 1 loved one, up to 15 CareText SMS/month, no daily automated sending.
- Plus: $9.99/month, up to 5 loved ones, 100 SMS/month shared with priority allocation; daily available subject to cap.
- Annual: proposed $47.90 Essential / $95.90 Plus, approximately 20% savings; verify final Polar product configuration.
- My Touch: personal copy/paste sending; CareTouch: human-approved automated delivery after recipient consent.
- Learn Me™: opt-in persistent writing-style preferences; Make It Sound Like Me: optional examples, independent of Learn Me.
- Trusted Autopilot: planned after 90 days and eligibility verification, explicit opt-in; not active in prototype.
- Billing date changes are **not** offered to subscribers.

## Production checklist
Consent language, TCPA/carrier review, privacy policy, terms, age restrictions, retention/deletion, accessibility, secure authentication, sender/recipient/relationship UUIDs, reliable reply routing, SMS segment budgeting, exact calendar dates, plan entitlement enforcement, timezone-safe jobs, rate limits, retry logic, billing webhooks, and tests.

## V4.1 — Learn Me™ consolidation

Learn Me™ is the single name for optional adaptive personalization, including up to two sample texts supplied by the sender. Writing examples are only shown when Learn Me™ is enabled; turning it off stops persistent style learning. No separate “Make It Sound Like Me” feature is presented.


## V5.1 changes
- FAQ AI disclosure no longer says recipients receive a separate notification when Trusted Autopilot is enabled; initial opt-in must clearly disclose AI-generated automatic messaging as a possibility.
- FAQ covers recipient opt-out, replacement, future downgrade, and refund review. Refund terms require legal/merchant approval before production.
- Homepage keeps the loved-one image/sample cards, removes LearnMe toggle (configuration-only).
- Free plan: consent displays N/A, reminder-only scheduling, and message generation on demand up to five illustrative credits in this demo.
- Essential recipient replacement policy proposed: one completed replacement per rolling 30 days, with exceptions. Not enforced until backend integration.
- Front-end demo uses local browser state, does not implement Polar billing, Twilio SMS, AI API, authentication, or monthly credit reset. Do not use as production service.

## V5.2 recipient change rule
Essential: one active recipient at a time and one voluntary completed replacement per rolling 30 days. Declined invitations, verified opt-outs, and incorrect numbers may qualify for exceptions; enforcement awaits backend. Refund terms are still under review.
