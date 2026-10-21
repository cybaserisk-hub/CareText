-- EMERGENCY DISABLE PLAN, NOT AN AUTOMATIC DOWN MIGRATION. Separate approval required.
-- Preserve all evidence and suppression. Disable endpoints/Verify first; do not drop data.
-- PRE-MESSAGING ONLY: this revokes the shared RPC including STOP intake. Before
-- customer traffic, provide a separately tested rollback that preserves STOP intake.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
revoke execute on function public.production_consent(text,jsonb) from public,anon,authenticated,service_role;
update public.relationships set caretouch_active=false where caretouch_active;
update private.consent_outbound set status='canceled',updated_at=now() where status in ('queued','accepted','scheduled');
alter table public.relationships add constraint relationships_caretouch_emergency_disabled check(caretouch_active=false);
commit;
-- Before any recovery, explicitly review removal of this constraint and regrant of RPC.
-- Re-enablement must re-evaluate consent/suppression; never bulk-reactivate relationships.
