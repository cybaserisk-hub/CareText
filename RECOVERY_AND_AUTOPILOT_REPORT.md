# CareText recovery and production integration preparation

Base commit: `5f5d713`. All work remains disabled/unpublished. No real export, paid resource, hosted migration, OTP/SMS, AI provider call, payment, registration change, Autopilot activation or campaign submission.

## Implemented and tested

- Authenticated AES-256-GCM recovery envelope, wrong-key/tamper/truncation rejection and explicit 24-hour recovery acceptance calculation.
- Actual **synthetic PGlite snapshot -> encryption -> decryption -> separate restored instance** rehearsal, with RLS ownership/insert denial and suppression preservation. No sensitive export or persistent key/file created. This does not validate pg_dump, a hosted restore, real volumes or disaster key retrieval.
- New **unapplied** `20261021045745_autopilot_readiness.sql`: service-only authoritative readiness RPC, append-only completed human-approved batch evidence, duplicate-approval rejection, manual/pause audit and subscriber in-app/email outbox records. RLS on every new private table; no browser grants. Existing manual/paused-only mode constraint and disabled delivery remain.
- Server service authenticates via Supabase getUser, derives sender from the verified user, obtains account creation through Auth Admin and reads actual consent/subscription/profile/batch state through the new RPC. Browser-supplied age, sender or batch counts are not trusted. Activation is unconditionally unavailable.
- Subscriber Autopilot panel integrated into the private account screen. Explicit opt-in checkbox starts unchecked and disabled; activation unavailable. Manual/pause controls support a future server adapter but remain disabled in the actual app because no endpoint is approved/mounted. Tests exercise server-backed pause, audit and notice creation. Notices are queued, never emailed.
- Semantic-safety adapter: bounded allowlisted context, normalized off-limits/prohibited-pattern checks, mandatory trusted semantic evaluator, every-category pass, timeout/abort, content/revision binding and durable audit requirement. Missing evaluator, ambiguity, malformed results or audit failure reject. No live evaluator configured; deterministic rules alone do not authorize sending or prove multilingual semantic safety.
- Seven-route static build remains unchanged in scope and has no new account panel, API, credentials or provider code.

## Exact database review scope

Canonical queue now has TWO pending production files, in order:

1. `20261021041742_production_recipient_consent.sql` — existing consent implementation, unchanged.
2. `20261021045745_autopilot_readiness.sql` — new readiness/control preparation above.

Both require isolated staging/restore validation and separate application approval. Do not use a blanket push on the assumption that only consent remains pending. The two SQL files under `tests/fixtures/migrations` stay outside the production queue. No hosted migration history was modified.

Rollback for the new readiness feature: leave/remove its server routing, revoke its service RPC execution only under approved operational change, keep modes paused/manual, and preserve batch/audit/notices. Do not drop evidence or revoke signed STOP intake. No live worker or dispatcher was installed.

## Hosting verification

Netlify project **caretextapp**, site ID `90e0a7a3-24b5-482a-ac44-24c9f87bd600`, team **CyBase Risk Tech**. Existing public drop deployment `6ad8006ea787370355b448cb` serves homepage/app, but legal/consent routes return 404. Domain dashboard lists ONLY the Netlify subdomain and says a custom domain is required for certificate provisioning. `caretext.app` has no A/AAAA/CNAME; `www` does not resolve. No custom-domain TLS certificate can be verified. Local Netlify TLS is Norton-intercepted, not independent origin evidence.

See `NETLIFY_REVIEW_VERIFICATION.md`. Publication approval is premature until the exact domain/HTTPS/artifact-switch plan is reviewed. No configuration was changed. The existing broad public prototype was not published by this work and remains untouched.

## Recovery proposal for exact approval

See `DEVELOPMENT_RECOVERY_PROPOSAL.md`: encrypted exports under `C:\Users\Lenovo\AppData\Local\CareText\recovery\exports`; separate DPAPI key custody plus owner-held offline recovery material; owner-designated existing removable device for off-machine recovery; local isolated PostgreSQL on loopback port 54329. Estimated incremental software/cloud cost **$0**, assuming existing disk/removable hardware and remaining provider quotas. No paid Supabase upgrade proposed. Docker/PostgreSQL CLI tools are not on PATH; installation/runtime choice needs a scoped decision.

RPO/RTO **24 hours each are proposed targets, not verified guarantees**. Real export, encryption streaming, manifests/consistent snapshots, managed Auth/Storage/history coverage, key custody, failure alerts, full hosted-role restoration and independent deletion/suppression replay remain to validate. Current tests are synthetic and in memory.

## Remaining engineering and security blockers

- Live dispatch remains absent. Readiness is NOT a delivery authorization. Atomic sender/phone/quota locking with STOP/payment/profile changes, approved batch completion ingestion from actual outcomes, scheduler slot provenance and uncertain-provider reconciliation still need integration and real PostgreSQL concurrency tests.
- Semantic provider/model, content policy/evaluation corpus and thresholds, privacy/retention terms and costs require selection/review before connecting live AI. No pass-by-default fallback. Current all-pass test responses are synthetic.
- Manual/pause preparation endpoint is unmounted and disabled by default; needs rate limiting, idempotent controls, hosted auth/RLS acceptance and separate API approval before exposure. Subscriber opt-in activation and confirmation delivery remain unavailable.
- Supabase Free lacks leaked-password protection and scheduled project backups. No upgrade is authorized; leaked-password protection remains a launch security blocker pending plan decision or reviewed alternative.
- Retention/deletion lifecycle, holds, external provider/mail/log copies, independently retained tombstones and restore replay remain incomplete. No unconditional deletion guarantee was published.
- Twilio needs reachable exact legal/opt-in evidence URLs, final campaign review, correct Advanced Opt-Out configuration, approved signed callback/STOP/HELP tests, and campaign approval. No submission or real sends authorized.

## Next exact owner decisions

1. Approve or amend the recovery source/directory/ACL/encryption/custody/retention/restore proposal; identify an existing removable device, owner/deputy and permitted local PostgreSQL installation. This approval must precede a real data export.
2. Review the two pending SQL files after successful staging/backup/restore validation, then separately approve project, exact commit/checksums, application window and rollback owner. No immediate migration approval requested.
3. Approve a CareText-only domain/DNS/HTTPS configuration and artifact-switch sequence after the precise Netlify DNS instructions are prepared. Do not point the domain at the existing prototype by accident. Seven-route publication is a later distinct approval; APIs excluded.
4. Select/review semantic safety provider, privacy/cost terms and acceptance criteria before any live AI integration. No paid AI use is authorized by this preparation.

No approval for upgrade, registration, Autopilot, payments, SMS or Twilio submission is implied.

## Verification

The first full run had two harness failures because account tests evaluated source text without resolving the new panel import. The harness now uses the actual panel implementation; no production behavior was bypassed to fix it. Final suite/build results are recorded below before commit.


Final verification: **25/25 tests pass**, app build and restricted review build pass, diff whitespace check passes. After adding immutable batch/duplicate-credit assertions, the affected server/UI suite also passes (2/2). No real provider was called by tests.

Reviewed workspace SQL SHA-256 values:
- Consent: `f9df8944192f576c838e506d19cfb5d6b7dac18350c5e654b8dfca7a628b47ae`.
- Readiness: `34f795d8834bc04be95a7d01b9436c8130177d61375230776db96b3c1e6589f7`.

Recompute hashes against the exact approved checkout before application (line-ending normalization can change byte hashes). Neither migration has been applied.
