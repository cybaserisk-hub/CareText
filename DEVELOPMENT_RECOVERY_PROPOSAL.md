# CareText development recovery: exact proposed scope

**Preparation only. No real export, key, paid resource, hosted restore or scheduled backup has been created.** Targets proposed by owner: RPO 24 hours and RTO 24 hours, not yet validated with real data or operational recovery.

## Decisions for owner approval

| Item | Proposed exact scope | Estimated incremental cost |
| --- | --- | --- |
| Export source | CareText development project `ixpniaronwgjimqyeowq` only; schema/data/roles and migration history, inventory Auth/config/Storage separately | $0 upgrade; existing project egress/quota still applies |
| Local encrypted export directory | `C:\Users\Lenovo\AppData\Local\CareText\recovery\exports` | $0 using existing disk |
| Permissions | Owner Windows account and SYSTEM only; disable inherited ACLs on this CareText folder; verify no junction/symlink, OneDrive sync, sharing or backup-agent upload; full-disk encryption recommended | $0 if existing Windows capability; no purchase assumed |
| Encryption | AES-256-GCM, fresh random 256-bit key per export and 96-bit nonce; authenticate format/version. Stream real export directly into encryption; never create plaintext SQL in workspace/Downloads/temp | $0 software; production streaming wrapper still to implement/review |
| Primary key custody | DPAPI CurrentUser wrapped keys in `C:\Users\Lenovo\AppData\Local\CareText\recovery\keys`; owner/SYSTEM ACL. Never GitHub, logs, command arguments, chat or browser | $0 |
| Disaster recovery key custody | Owner holds a separately encrypted offline copy on an **existing** removable device, unlocked by an owner-held recovery passphrase; owner identifies device and custody. DPAPI alone is not adequate after machine/account loss | $0 if existing device; purchase requires separate approval |
| Off-device backup | Copy encrypted exports to the same owner-designated offline backup device, keeping recovery passphrase separately. Local disk alone cannot meet device-loss recovery | $0 if device already owned; no cloud upload proposed |
| Restore destination | Disposable local PostgreSQL matching hosted major version, loopback `127.0.0.1:54329`, data under `C:\Users\Lenovo\AppData\Local\CareText\recovery\restore`; no public port, SMTP, provider credentials or outbound network; no connection to hosted production | $0 software on existing hardware; install/configuration separately scoped, no paid hosted project |
| Schedule/retention | Proposed exports every 12 hours; alert owner on failure and before newest verified backup reaches 24 hours. Keep 7 daily + 4 weekly encrypted copies (about 28 days); holds documented separately | $0 local scheduling; not installed or enabled |
| RPO/RTO acceptance | Prove a backup no older than 24 hours and a complete, quarantined, validated recovery within 24 hours including key retrieval, setup, restore, tombstone replay and permissions verification | Owner time, no fee estimate |

The chosen removable device, recovery custodian/deputy, storage capacity, disk protection, alert destination and permitted local installation must be confirmed. Do not run an export merely because the directory has been proposed. No Supabase upgrade is needed for this plan; lost-machine recovery remains unvalidated until an independent copy/key is tested.

## Synthetic rehearsal completed

`tests/recovery.test.mjs` creates a synthetic PGlite database, exports its data directory **in memory**, encrypts it with an ephemeral random key, rejects wrong keys/tampering/truncation, decrypts and restores into a distinct in-memory instance, and verifies owner-isolated RLS and retained suppression. Key is cleared after the test; no real records or persistent export files are used. RPO/RTO boundary tests require an explicit validation flag and reject stale/invalid timestamps.

This verifies the encryption primitive and synthetic restore mechanics, NOT pg_dump compatibility, Auth recovery, Storage object backup, full production RLS, real data volumes, key custody, hardware failure or 24-hour operational targets. The in-memory helper has a 128 MiB bound and must not be used as an unreviewed full-database export tool.

## Procedure after exact approval

1. Inventory version/extensions, application and private schemas, Auth customizations, migration history, storage objects, database jobs/webhooks, managed roles, Vault/encryption dependencies and dashboard settings. Record metadata without exporting secrets. Review sensitive data categories in the export scope. Supabase default dumps omit some managed schemas; do not assume a single default dump captures Auth/history/storage/config.
2. Verify ACLs, no sync/reparse paths, disk encryption/capacity and recovery key custody. Configure audited CareText-only credentials through an approved secure channel, never command-line connection URLs containing passwords. Do not reset the existing database password casually.
3. Use a version-compatible `pg_dump`/Supabase CLI workflow, a consistent snapshot across dependent data, and an explicit reviewed schema/role/history manifest. Stream directly into authenticated encryption with exclusive output creation; delete only verified incomplete encrypted files in the approved directory on failure. Validate child-process exit, ciphertext authentication, size/checksum, manifest coverage and restore readability before declaring success.
4. Preserve migration history as it actually exists. Excluded test migrations stay excluded. Export Storage bytes separately if any; config/secrets and encryption keys require their own approved secure recovery path. A backup of DB rows is not a backup of object bytes.
5. Create the approved isolated local destination; disable outbound traffic, schedulers/webhooks/extensions that could call external systems and all application gates BEFORE loading records. Restore with stop-on-error and transaction strategy suitable for the actual dump format; verify managed-role compatibility. Never restore over the hosted database as a drill.
6. Restore schema/grants/data/history. Replay independently retained deletion and suppression records; quarantine all Autopilot work. Revoke restored sessions before any permitted user access. Validate owner isolation through two synthetic users, anonymous denial, service-only RPCs, evidence immutability, STOP suppression, LearnMe deletion, constraints and all disabled gates.
7. Record start/finish and newest included transaction timestamp, checksums and counts without content/phone/token/passwords. Validate RPO and RTO with owner key retrieval and process downtime included. Fail recovery acceptance if any dependency is missing.
8. Keep quarantine until owner approves disposal or further use. Restore does not authorize deployment, registration, sending, AI, payments or hosted migration. Cleanup must preserve necessary evidence/holds and use bounded verified paths.

Reference: [Supabase CLI backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Follow current managed-schema, role, migration-history, Vault/key and Storage caveats; the documentation is not authorization to reset passwords or create a project.

Local prerequisite check: `docker`, `pg_dump` and `psql` were not found on PATH. No runtime was installed. Approve the exact local runtime/version and installation scope before a real logical export/restore drill. PGlite synthetic tests do not require these tools.
