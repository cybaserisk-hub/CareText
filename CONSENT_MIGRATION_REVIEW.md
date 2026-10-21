# Controlled migration review

Preparation from `3badc71`. **No hosted migration, backup restore, paid OTP, or deployment performed.** Read-only hosted verification succeeded using the existing CLI authentication with `NODE_USE_SYSTEM_CA=1`; the connector was unavailable. Evidence: [catalog comparison](docs/consent-compatibility.json).

## Current compatibility result

CareText project: `ixpniaronwgjimqyeowq`. Hosted migration history contains the first five repository migrations, through `20261021031107_recipient_consent_test_workflow.sql`. Catalog replay comparison found no differences in expected application tables/RLS flags, columns/nullability/defaults, constraints, policies, relationship column permissions, triggers, plan allowances or required table grants. Function identities, invoker/definer flags and search-path settings match. This is not a byte-for-byte function-body audit or proof of hosted runtime behavior. PostgreSQL version differences in NOT NULL catalog representation are normalized; column nullability is compared separately.

There are zero active CareTouch relationships. Production consent objects are absent. The existing `(id,sender_id)` unique keys and ownership FKs, private schema, service-role usage, plan allowances and onboarding structures support the pending production migration. Existing signup restrictions and Autopilot manual/paused constraints are retained.

Hosted security advisor: one WARN, **Leaked Password Protection Disabled**. See [Supabase remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Owner should review availability/cost and approve Auth configuration separately; no change made. No other security-advisor findings returned. This result applies to the existing schema, not the unapplied migrations.

## Exact pending database scope

| File | Effect | Approval status |
| --- | --- | --- |
| `supabase/migrations/20261021034035_twilio_local_workflow.sql` | Four private test tables and service-role-only `twilio_local_test` RPC; simulator evidence only. Already committed but NOT hosted | Pending. Production consent does not need these objects, but a normal migration push would include this earlier file. Explicitly approve both files or decide a reviewed migration-history strategy first; never silently mark it applied |
| `supabase/migrations/20261021041742_production_recipient_consent.sql` | Seven private production tables, public sender-isolated replies, indexes/FKs/RLS/grants, invoker RPC, activation trigger replacing the always-false constraint | Pending. Updated while still unapplied: 5-second lock timeout, 60-second statement timeout, explicit revocation of inherited service-role table grants before least-privilege grants |

The production migration does not copy test consent into production or update existing data. It removes `relationships_caretouch_active_check` and replaces it with the verified-consent/entitlement trigger. It grants no delivery capability. Immutable evidence is append-only for service_role; owner/admin can still maintain it under a separately audited retention procedure. The authenticated sender has SELECT-only access to their routed replies. No anonymous/private access, browser activation, subscription write, or Autopilot enablement is added.

## Before any approved application

**Recommendation: exclude `20261021034035_twilio_local_workflow.sql` from production.** It adds only contract-test tables/RPC, and the new production-only integration test replays the five hosted migrations plus production consent successfully without it. It adds unnecessary test surface and retention burden to production.

Safe history strategy for a separately approved repository change: recheck migration history in EVERY shared hosted/staging environment; confirm the test version is unapplied everywhere that shares this chain. Preserve its exact SQL in `tests/fixtures/migrations/`, move it out of `supabase/migrations/`, and update offline-contract test loaders to explicitly include that fixture. Do not remove the earlier already-hosted recipient-test migration in this cleanup. Re-run both production-only and full fixture tests, then verify migration list shows only production consent pending. Preserve Git history and document the exclusion. Do not mark the excluded migration applied using repair, invent an empty applied record, or edit a shared applied migration. If any shared environment has applied it, stop and review an environment-specific forward cleanup/history plan rather than using this move blindly. No file has been moved and no migration-history repair has been performed in this task; the current root migration directory still includes BOTH pending files, so a blanket push remains prohibited.

Production SQL remains unapplied and includes the new withdrawal-only view for expired accepted invitations. Expired pending links cannot verify/accept; current consent can withdraw; superseded links cannot revoke newer consent. Model scope is taken from preserved policy version, with new v3 grants covering both delivery models. No old evidence is updated. Local tests prove these boundaries; hosted acceptance remains required.

1. Obtain explicit approval naming project, both pending migration decisions, exact commit/hash, maintenance window and rollback owner. Keep endpoint runtime, verification and all sending off. Avoid concurrent recipient/onboarding edits during application.
2. Re-run the read-only history and `deployment/consent-preflight.sql`; compare against this evidence. Abort on drift, nonzero active relationships, existing pending objects or changed grants. Review the production SQL and both pending file hashes; `db push` is NOT a one-file operation here.
3. Inspect the project's actual backup plan, latest successful backup/export timestamp, restore destination and encrypted export location. Record RPO/RTO and perform a restore drill in an isolated approved environment. Do not create a paid Supabase branch without approval. Database backups exclude Storage object bytes; inventory any Storage and Auth/config dependencies separately. No backup availability or successful restore was verified in this preparation.
4. Confirm private schema is not exposed through Data API; verify service credentials are restricted to server runtime, logs omit token/code/phone/body, and no public signup setting changes are bundled.
5. Replay approved migrations in isolated staging with representative synthetic existing relationships. Run the full suite and actual PostgreSQL/Supabase checks; PGlite alone does not validate PostgREST, hosted roles or extensions. Validate transaction rollback on lock/statement timeout. The pending migration is atomic; do not split statements into independently committed dashboard runs.
6. Only after separate approval, apply precisely the reviewed pending set with the normal migration mechanism. Preserve migration history; do not run arbitrary `db reset`, `--include-all`, repair, or old architecture SQL. Stop on error; inspect history/catalog before retrying.

Read-only commands (already exercised; no passwords in command arguments):

```powershell
$env:NODE_USE_SYSTEM_CA='1'
npx supabase migration list --project-ref ixpniaronwgjimqyeowq
npx supabase db query --linked --project-ref ixpniaronwgjimqyeowq --file deployment/consent-preflight.sql
npx supabase db advisors --linked --project-ref ixpniaronwgjimqyeowq --type security
```

## Post-application verification, before any endpoint is enabled

- Confirm migration history, RLS on all eight new tables, exact grants and service-only RPC EXECUTE; confirm invoker functions and empty search_path. Repeat advisors (security and performance).
- Through hosted PostgREST, verify anon cannot read/execute; two authenticated synthetic senders cannot read each other's replies, activate CareTouch, change entitlements or inspect private evidence. Test direct update denial and nonconsented activation denial. Do not manufacture real consent or invoke live provider calls.
- Repeat synthetic decline/expiry/replay/withdrawal/STOP/HELP, changed phone/schedule, multi-sender ambiguity, replacement/capacity tests using isolated test fixtures. Confirm evidence cannot UPDATE/DELETE/TRUNCATE as service_role; inspect privileged counts, not just RLS-filtered results.
- Verify transaction serialization for concurrent STOP versus acceptance, duplicate callbacks and capacity reservations in real PostgreSQL; local tests do not simulate every multi-connection race.
- Recheck no public signup, dispatch, payment or Autopilot capability; the controlled Verify ledger must remain closed. Clear only synthetic data with an approved cleanup procedure; never drop suppression/evidence indiscriminately.

## Rollback and recovery

If migration fails within its transaction, roll back; confirm the original activation constraint and absence of partial objects, then investigate. Do not retry while a lock remains unexplained.

After a successful migration, prefer **disable and fix forward**. Turn off endpoint runtime/Verify first. The reviewed `deployment/consent-disable.sql` revokes RPC execution, deactivates CareTouch, cancels local queued records and adds an emergency always-false activation constraint. It preserves consent evidence and suppression; it is tested locally but NOT applied. It requires separate approval. It is a one-time emergency script, not an automatic down migration. If a dispatcher is ever introduced, provider queues require separate cancellation too.

This blanket RPC revoke also prevents incoming STOP persistence. It is suitable only for the present pre-messaging phase. Before any messaging launch, implement and verify a rollback path that retains signed STOP intake/durable suppression while disabling new consent, generation and dispatch; do not reuse this script unchanged after customer traffic exists.

Do not drop tables or restore an old backup over live consent data as a routine rollback. Restoring may resurrect deleted content or lose later opt-outs. Quarantine restores, replay independently protected deletion and suppression records, verify integrity, then obtain recovery approval. Removing the emergency constraint/regranting RPC must be reviewed; never bulk-reactivate relationships. A website fix should be a reviewed forward commit while deployment remains blocked.

## Retention gates

Owner targets remain operational proposals, not statutory Texas requirements: eligible profile/content deletion within 30 days; immediate LearnMe personalization stop and prompt active-data deletion; five-year consent evidence; necessary minimal suppression; seven-year accounting; 90-day logs/backups subject to capabilities. See `PROVIDER_RETENTION_REVIEW.md`.

Consent FKs intentionally restrict account/recipient deletion while evidence exists. A documented anonymization/deletion design, legal-hold exceptions and privileged maintenance are still needed. No scheduled five-year cleanup, 90-day logs/rate-bucket cleanup or restore-time deletion replay exists. Determine the consent retention clock (withdrawal versus last relevant communication), account for quarantined reply bodies and external provider records, and verify actual Supabase/Netlify/Twilio/Resend settings. Payments/AI remain off. Do not publish an unconditional deletion guarantee.

Reference: [Supabase backup coverage](https://supabase.com/docs/guides/platform/backups). Changelog reviewed; the forthcoming legacy TLS cipher removal does not change SQL requirements, but supported modern clients must be used for deployment tests.
