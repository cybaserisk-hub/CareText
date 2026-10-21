# Offline SQL fixtures

These files are NOT part of the production migration queue and must never be included in `supabase db push`.

- `20261021034035_twilio_local_workflow.sql`: original committed test migration moved with owner approval after hosted history showed it unapplied and no project branches. Byte-preserving move, no migration repair. Loaded only by the local Twilio contract test/harness.
- `20261021045006_autopilot_preparation.sql`: generated via CLI, offline development-state table only. Explicitly loaded by the Autopilot test. Synthetic snapshots are not production authorization.

The already-hosted recipient consent simulator migration remains in canonical history. Never delete or relabel applied migrations to clean up test features.
