# Backup, retention, deletion and restoration validation plan

**Plan complete; provider configuration and destructive acceptance not executed.** Targets are operational policies supplied by the owner, subject to law and provider capability; they are not Texas statutory periods. Do not publish unconditional guarantees. All backups/exports must be encrypted, access-controlled and outside GitHub, public artifacts and ordinary synced workspace folders.

## Inventory and evidence required before migration

Record CareText-only project/account, plan, region, backup method, successful backup timestamp, earliest/latest recoverable point, expiry, authorized custodian, encryption/key recovery and any export/log-drain locations. Obtain written owner approval for RPO/RTO, retention/legal holds, cost ceiling and isolated restore destination. Verify restore capacity without creating a paid project or addon implicitly. Credentials and content stay out of reports; use redacted metadata and checksum attestations.

| System | Limitation to validate | Required account-specific evidence |
| --- | --- | --- |
| Supabase | Plan-dependent daily backups/PITR; database backups exclude Storage object bytes; role secrets and dashboard/Auth configuration require separate inventory. A dashboard backup listing is not a restore test | Actual plan, backup/PITR history, Storage inventory, encrypted restore drill, roles/grants/RLS/Auth allowlist recheck. Existing audit FKs can block ordinary account deletion |
| Netlify | Deploy retention and runtime/log-drain retention are separate. Removing a deployment does not prove removal from logs or external drains | CareText site/team settings, old artifact audit for PII/secrets, drain destinations and lifecycle. No credential belongs in static review output |
| Resend | Outbound delivery records, provider backups and account termination retention differ from per-person deletion; a shared account must not be deleted to satisfy CareText requests | CareText domain/key isolation, actual plan/retention terms, per-message deletion/support procedure, provider residual-retention explanation; do not modify CyFireAI |
| Twilio Verify/Messaging | Verify logs and messaging records have different lifecycles. Redaction can leave restricted compliance copies; UI/API disappearance is not proof of full erasure | Actual retention/redaction availability, compliance exceptions, costs, export and deletion support. Preserve independent consent/suppression evidence; do not delete the number/account as a per-user workaround |
| Polar | Transaction/legal retention may be provider-controlled; CareText's seven-year target is not proof of provider configuration | Contract/merchant-of-record duties, transaction export and erasure exceptions before enabling payments; never store full card/bank credentials |
| AI services | Provider/model is not yet integrated; request logs, training, abuse monitoring and stateful storage can differ by endpoint/plan | Selected provider/endpoint/DPA/region, training setting, retention/deletion and applicable zero-retention eligibility; no assumed zero retention |
| Cloudflare routing / Gmail support | Forwarding does not erase mailbox copies, attachments, trash, downloads or provider logs. Labeling is organization, not a retention policy | CareText-only mail procedure, privacy-request identity checks, response owner/deputy, deletion/hold handling and export locations; no changes to unrelated business mail |

## Retention implementation and measurable acceptance

| Category / owner target | Procedure and test needed | Evidence of completion |
| --- | --- | --- |
| Profiles/accounts: eligible deletion/anonymization within 30 days | Verified request, revoke access/sessions, stop dispatch, resolve references with a reviewed evidence-preserving anonymization plan; test legal hold and mixed-sender recipient separation | Privileged counts/lookup checks, request audit and provider outcomes; do not infer deletion from RLS hiding |
| Drafts/generated texts/replies: within 30 days after eligible account deletion | Include quarantine, caches, queued content, approval snapshots and recipient replies; reconcile necessary audit exceptions | Synthetic canary search in active stores and exported records; no content in general logs |
| LearnMe: immediate personalization stop, prompt active deletion | Preserve separate preference; successful Save setup disables and removes examples/history today. Future workers must invalidate caches/pending generation and discard stale results | Regression test plus future worker race tests; do not claim immediate backup deletion |
| Consent: five years after withdrawal or last relevant communication | Owner/legal must define the clock (recommended review: later relevant event) and holds; immutable operational evidence needs a narrowly privileged, audited lifecycle process | Clock-boundary tests, hold/release tests, no browser/service blanket DELETE grant; not implemented |
| Suppression: minimum necessary as long as needed | Retain minimal durable suppression independently of account content and restore snapshots; no reactivation from deletion | Deleted-account and restored-backup attempts remain blocked; no plaintext phone in general logs |
| Accounting: seven years | Minimal references; approved accounting/legal exceptions; reconcile Polar responsibilities | Policy and access audit before payments; no card/bank storage |
| Operational logs: 90 days unless held | Enumerate database, host, email, provider, drains and local diagnostic files; rate buckets should expire sooner under a reviewed schedule | Lifecycle configuration, synthetic boundary tests, hold exception inventory; no universal vendor purge claim |
| Backups: target expiry/deletion within 90 days | Include manual exports and operator copies; provider exceptions documented; no unsupported per-record rewrite promise | Actual lifecycle evidence for every copy and successful restore-time deletion replay |

## Isolated restoration drill (separate approval required)

1. Freeze the test scope, select an approved backup and isolated destination with network egress, workers, Auth emails, OTP, SMS and payments disabled. Never restore onto production to test a backup. Snapshot configuration and verify recovery keys independently.
2. Seed synthetic canaries only in an approved test environment: two sender accounts, separate/shared recipients, v2/v3 consent, a STOP, withdrawn grant, LearnMe data, message/quarantine content and a privacy deletion request. Take the test backup at T0; perform the authorized deletion and STOP at T1.
3. Maintain an independently protected deletion/opt-out ledger outside the restored snapshot. It contains minimal identifiers/timestamps, not message content. This facility is not implemented yet and is a release blocker.
4. Restore T0 in quarantine; validate roles, ownership FKs, RLS, triggers, grants, migration history, server-only secrets and the private registration gate. Restore Storage bytes/configuration only from separately verified sources. Do not connect stale provider credentials to a sender.
5. Replay all T1 deletion/opt-out records idempotently BEFORE application access. Apply holds/exceptions deliberately; verify deleted canaries absent, minimal suppression retained, consent not resurrected, stale sessions unusable and queued content unable to send. Repeat replay and simulate partial failure: remain quarantined, never partially resume.
6. Measure actual loss window and restore duration against approved RPO/RTO. Record redacted counts/checksums and reviewer sign-off; test key-loss/backup failure escalation. Validate encrypted export expiration and access revocation.
7. Only an independently approved recovery action may reopen endpoints after all gates pass. Keep messaging/Autopilot off until separate launch approval. Destroy the test environment/exports only under an approved cleanup scope, including retained legal evidence.

## Privacy request operations

Owner assigns primary/deputy monitoring, request tracking, verified identity method, five-business-day acknowledgment and 30-calendar-day substantive response targets (or applicable shorter deadline), extension/appeal handling, legal-hold escalation and completion review. Test subscriber and recipient requests, identity mismatch, shared phone under multiple senders, lawful retention explanations, partial provider failure, retry and overdue alerts. Inbound mailbox delivery is verified; this does not establish staffing or a working erasure process.

## Sources and current limits

[Supabase backups](https://supabase.com/docs/guides/platform/backups) and [restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore); [Resend security/retention](https://resend.com/security); [Twilio redaction](https://www.twilio.com/docs/messaging/guides/privacy-message-redaction); [Polar privacy](https://polar.sh/legal/privacy-policy); `PROVIDER_RETENTION_REVIEW.md` contains prior provider research. Documentation review is not verification of account settings. No real account was deleted, backup restored, paid add-on purchased or retention setting changed during this preparation.
