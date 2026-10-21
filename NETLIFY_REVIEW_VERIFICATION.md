# CareText Netlify / DNS / TLS read-only verification

No hosting, DNS or certificate configuration changed. No deployment performed.

## Exact existing site

- Site: **caretextapp**; ID `90e0a7a3-24b5-482a-ac44-24c9f87bd600`.
- Dashboard: https://app.netlify.com/projects/caretextapp
- Existing published deployment: `6ad8006ea787370355b448cb`, state ready, production context, title **Build from drop deployment**, published `2026-10-21T00:00:21.112Z`.
- No commit SHA/branch is associated with this existing deployment. Do not claim it contains `5f5d713` or later work. API reports no functions, edge functions or schedules. Access controls report no password/SSO requirement.
- Existing primary endpoint: https://caretextapp.netlify.app . Read-only HTTP checks: `/` 200 (CareText homepage), `/app.html` 200 (CareText My Space); `/privacy`, `/terms`, `/invite`, `/account.html` all 404.

The existing prototype is already public on the Netlify subdomain; the repository deployment blocker does not unpublish it. It was not changed by this task. Any removal/replacement of this deployment needs an explicit scope decision.

## Domain and certificate findings

- `caretext.app`: DNS A, AAAA and CNAME queries returned no data. SOA points to Cloudflare (`james.ns.cloudflare.com`). HTTPS could not connect: name resolution failed.
- `www.caretext.app`: DNS name not found. No TLS connection possible.
- `caretextapp.netlify.app`: A/AAAA resolved and HTTPS returned valid responses using normal certificate validation.
- The local TLS connection is inspected by **Norton Web/Mail Shield Root**. The locally observed leaf has subject/SAN `*.netlify.app`/`netlify.app`, validity February 16, 2026–March 19, 2027. This is NOT independent evidence of Netlify's origin certificate. Certificate checks were not bypassed.

**The caretext.app TLS certificate is unverified and its legal URLs are not reachable.** The Netlify Domain management dashboard was read: its production domains list contains ONLY `caretextapp.netlify.app`; there is no custom domain. HTTPS states **A custom domain is required to provision a certificate**. Before publication approval, configure the separately approved CareText-only domain attachment/DNS and validate an issued certificate for caretext.app from a non-intercepted external vantage point, and retest exact URLs. Do not point the domain at the current broad prototype before approving which artifact will be served. Do not modify existing Resend/Cloudflare routing records or CyFireAI.

## Prepared artifact

`node scripts/build-review.mjs` creates ignored `review-dist` with the exact seven routes in `deployment/review-scope.json`: `/privacy`, `/terms`, `/invite`, `/style.css`, `/legal.css`, `/assets/caretext-logo.svg`, `/invite/flow.js`.

All other routes force 404, including homepage, app/account, config, registration, APIs and function aliases. No credentials or executable server functions included. Static invitation is review evidence only; no verification or consent submission endpoint is exposed. CSP/no-store/no-referrer headers preserved. Existing `netlify.toml` remains unconditionally deployment-blocked.

**Do not request final publication approval as if verification is complete.** Required next scoped decision: approve preparation of CareText domain attachment/DNS/certificate configuration only after exact dashboard values and artifact-switch sequence are reviewed. Publication and functional endpoints remain distinct approvals. Before eventual static publishing, retain this existing deployment ID as rollback evidence, but do not automatically roll back to its broad public prototype: owner must choose whether rollback means an all-404 maintenance artifact or the older site.
