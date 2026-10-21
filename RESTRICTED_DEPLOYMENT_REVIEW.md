# Exact restricted Netlify scope for review

**Not deployed. No endpoints approved. No DNS, Netlify dashboard or secret settings changed.**

`netlify.toml` still runs the unconditional `scripts/deployment-disabled.mjs` failure for all contexts. Its proposed publish directory is now `review-dist`, and function discovery points to `deployment/no-functions`, an empty entrypoint directory. The ordinary full application `dist` is never the proposed review artifact.

Run `node scripts/build-review.mjs` locally to prepare, not publish. It copies only the source files enumerated in `deployment/review-scope.json`, without reading environment credentials, bundling account code or invoking the full-app build. It refuses a nonempty approved-endpoint list: adding an endpoint requires reviewed implementation, not just editing a flag. Generated output is ignored by Git.

| Allowed URL | Exact source |
| --- | --- |
| `/privacy` | `site/privacy/index.html` |
| `/terms` | `site/terms/index.html` |
| `/invite` | `site/invite/index.html` |
| `/style.css` | `site/style.css` |
| `/legal.css` | `site/legal.css` |
| `/assets/caretext-logo.svg` | `site/assets/caretext-logo.svg` |
| `/invite/flow.js` | `site/invite/flow.js` |

Generated `_redirects` explicitly rewrites those exact paths to their static files, then forces every unlisted route to a generic 404. There is no SPA fallback, API proxy, wildcard asset exposure or function bundle. `/`, `/account.html`, `/app.html`, `/config.js`, `/api/*`, `/.netlify/functions/*`, source/SQL/docs and direct `/privacy/index.html` aliases are outside the list. Netlify normalizes trailing slashes; validate that behavior in the separately approved environment. Branding home links lead to the intentionally unavailable root in this restricted scope.

Generated `_headers` sets restrictive self-only script/style/image/connect CSP, no frames, no base override, same-origin forms, no-referrer, no-store, nosniff, disabled camera/microphone/geolocation and noindex. Root Netlify referrer policy also uses no-referrer to avoid precedence conflicts. Static header rules do not secure future function responses; handlers must set their own security/no-store headers.

The invitation shell is not a functional hosted consent workflow in this scope. With no token it requests a valid invitation; with a token, the unavailable API produces a clear no-consent-recorded message. Do not present the shell alone as proof of working opt-in. Local synthetic screenshots are in `docs/evidence`; they are not included in the public output.

## Separate future endpoint decisions

| Proposed route | Minimum security and remaining work | Current status |
| --- | --- | --- |
| `POST /api/invitations` | Production runtime only; trusted platform client IP; fixed origin; JSON/body limits; durable HMAC rate buckets; verified bearer identity for create/revoke; token/phone/disclosure/expiry/provider checks for recipients; server secret storage. Resolve authenticated private sender UI same-origin access without opening public registration | Not mounted, not approved, no Verify sending |
| `POST /api/twilio/inbound` | Official SDK signature on exact canonical URL; account/service/number binding; bounded form parsing; transactional dedup; durable STOP/suppression; HELP empty TwiML; ambiguous replies private | Not mounted, not approved |
| `POST /api/twilio/status` | Same signature/context checks plus known outbound SID and monotonic status; not needed until delivery is independently approved | Excluded |

No consent endpoint is implied by approval to publish static legal pages. A later host adapter must explicitly select allowed routes, restrict default function URLs (including `/.netlify/functions/*`), reject alternate paths/queries, and avoid mounting simulator or controlled-OTP routes. Paid Verify requires its own new destination/budget/send-count approval; the previous test gate stays closed. No public endpoints or secrets are introduced in this preparation.

## Approval and verification sequence

1. Owner approves the exact static route list and final policy text, and identifies the CareText Netlify site/domain and whether existing public content may be replaced. Confirm the site has no existing edge functions, redirects, plugins, form handling, injected scripts, or dashboard configuration that widen scope. Inspect existing deploy/domain state without modifying other products.
2. Keep auto-publish/build hooks/branch previews blocked until that approval. This repository cannot prove account-level deployment locks, so review the dashboard before any future manual action. No deployment command is part of this preparation.
3. In a separate reviewed change, replace the failing build command with the restricted build only after approval. Never substitute `npm run build` or deploy full `dist`. Static-only scope needs no Supabase/Twilio/Polar secrets or publishable key.
4. Test the exact allowed URLs, trailing-slash behavior, denied routes, no function aliases, CSP/referrer/cache headers and browser network requests in the approved environment. Current automated routing tests inspect the generated rule set; they are not a Netlify CDN execution test.
5. If functional opt-in is required for review, obtain additional endpoint/migration/send approvals, mount a reviewed adapter, and test isolated real end-to-end consent. Do not enable delivery merely to make the review page functional.

References: [Netlify redirect processing](https://docs.netlify.com/manage/routing/redirects/overview/), [custom headers](https://docs.netlify.com/manage/routing/headers/).
