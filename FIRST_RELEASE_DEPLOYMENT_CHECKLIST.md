# First-release deployment approval checklist

All boxes below are pending unless evidence is explicitly identified. The owner has approved preparation only. `netlify.toml` continues to fail builds, functions are not mounted, and the controlled OTP gate stays closed. Do not conflate static review, API availability, paid verification, campaign submission or launch approval.

## Stage A: reviewer-accessible static pages

- [ ] Owner approves final Privacy, Terms, v3 two-model disclosure, campaign text and synthetic evidence, plus exact CareText Netlify site/domain and replacement scope.
- [ ] Approve only GET `/privacy`, `/terms`, `/invite`, `/style.css`, `/legal.css`, `/assets/caretext-logo.svg`, `/invite/flow.js`. Exact sources are in `deployment/review-scope.json`; no account/onboarding/signup/payment pages, source files, simulator, API or function aliases.
- [ ] Inspect existing Netlify UI routing, edge functions, plugins, injected scripts, previews, build hooks, branch deploys and domain ownership. Static file allowlisting alone cannot remove an unrelated pre-existing edge function. Do not modify CyFireAI or other services.
- [ ] In a separate approved commit, use only `scripts/build-review.mjs` and `review-dist`, never the full `dist`. Keep secrets, Supabase config and server code outside output; no API credentials required for this stage.
- [ ] Verify exact routes and normalized slash behavior on the real CDN; all other paths including `/.netlify/functions/*` return 404. Check no-referrer, no-store, restrictive CSP, nosniff, frame denial, TLS, static asset loading and desktop/mobile rendering. Current tests validate local output, not deployed CDN behavior.
- [ ] Public policy URLs must work without login. The tokenless invitation shell is not functional consent proof; use owner-approved labeled screenshots if accepted by Twilio, or wait for Stage B. Never publish a real recipient token or pretend synthetic screenshots show live acceptance.

Static rollback: stop further publishes, remove public exposure using an explicitly approved fail-closed forward configuration or maintenance change. Restore no old broad app artifact. Keep the repository build block until a separately reviewed recovery. Verify the resulting public routes, domain/TLS and logs; no default action may reopen registration or APIs.

## Stage B: functional consent and recipient protections

- [ ] Approve migration-history exclusion strategy, production migration hash, maintenance window, actual backup evidence, isolated restore test and authorized operator. Verify hosted RLS/permissions and advisor results afterward.
- [ ] Approve each exact endpoint separately; currently NONE are approved or mounted:

| Route | Security requirements |
| --- | --- |
| POST `/api/invitations` | Production runtime only; exact allowed origin; no query string; bounded JSON; trusted platform IP, durable HMAC rate buckets; verified Supabase bearer identity and ownership for create/revoke. Recipient actions require opaque token, phone binding, immutable disclosure/version, bounded attempts and provider-context verification. Withdraw must remain usable after invitation expiry; old token cannot change newer consent. No simulator or caller-controlled sending flag |
| POST `/api/twilio/inbound` | Official SDK signature on canonical HTTPS URL and full parameters; bounded form input; correct account/service/number; MessageSid dedup; durable STOP/suppression; HELP handling with no duplicate TwiML reply; private quarantine of ambiguous replies; generic failures with safe provider retry handling |
| POST `/api/twilio/status` | Defer until delivery scope approved; same signature/context controls, known outbound SID and monotonic state. Never trust status callbacks as consent evidence |

- [ ] Implement a reviewed host adapter, default-URL/path protections and server-only secret configuration. Separate endpoint enablement from Verify sends; no previously approved test credentials/gate reused. Future function responses must set security/no-store headers themselves, not rely on static `_headers`.
- [ ] Approve new limited real OTP destination/budget/count and callback-test scope, including provider-generated keyword replies. Verify phone ownership, v3 acceptance, expiry/withdrawal, stale phone/schedule, cross-sender rejection and STOP races in the hosted path. Test throttling/concurrency without additional paid sends unless budgeted.
- [ ] Resolve START vs persistent application suppression, mode-change notice requirements and re-enrollment. Configure Advanced Opt-Out only under its own approval; it can send replies independently of CareText.

Pre-messaging API rollback: disable new verification/acceptance and secret access, fail endpoints closed, apply the separately approved pre-messaging `deployment/consent-disable.sql` if necessary, retain all evidence/suppression, and reconcile callbacks before recovery. Never drop data or mark migrations reverted when objects remain. After real messaging exists, preserve signed STOP intake/durable suppression during rollback; the current blanket RPC revoke must NOT be used unchanged. Provider queue cancellation and inability to recall already-submitted SMS must be handled explicitly.

## Stage C: first-release Autopilot and delivery (still blocked)

- [ ] Implement and pass every criterion in `TRUSTED_AUTOPILOT_ACCEPTANCE.md`, including authenticated per-relationship mode controls, server 90-day eligibility, explicit opt-in, recipient scope, content safety, quota/schedule locks and suspension. Any new mode-control endpoint needs a separately reviewed route/method/action list, ownership and CSRF protections; it is not implicitly approved by Stage B.
- [ ] Select/configure AI processing only after privacy/retention and content-policy review. Never assume the design starter provides complete authorization. Payments and entitlement-source integration need separate approval.
- [ ] Retain immutable human approval for standard CareTouch and mode/safety evidence for Autopilot. Match message identity/links/phone flags to campaign samples. Complete segment accounting, final send-time checks and provider idempotency.
- [ ] Complete backup/deletion/restore acceptance and privacy-request staffing. Enable leaked-password protection only after plan/cost and setting approval. Public registration requires an independent reviewed change; the allowlist is not removed by deployment.
- [ ] Owner separately approves Twilio campaign submission/fees, resolves carrier feedback, confirms service/number association and then approves a bounded launch. No scope approval substitutes for carrier approval or sending permission.

Launch rollback must durably stop dispatch and generation immediately, suspend Autopilot and cancel eligible queued work while preserving STOP/HELP and opt-out recording. Automatic restart/resume is forbidden until all gates are revalidated. Restore in quarantine with deletion/suppression replay; never resume from a stale backup automatically.
