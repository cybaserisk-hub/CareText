begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Preparation storage only. Does not alter the manual/paused production constraint,
-- grant activation capability, install a worker, or expose a public RPC.
create table private.autopilot_development_state (
 sender_id uuid primary key references public.profiles(id),
 revision bigint not null default 0 check(revision>=0),
 state jsonb not null check(jsonb_typeof(state)='object'),
 updated_at timestamptz not null default now()
);
alter table private.autopilot_development_state enable row level security;
revoke all on private.autopilot_development_state from public,anon,authenticated,service_role;
grant select,insert,update on private.autopilot_development_state to service_role;
comment on table private.autopilot_development_state is
 'Development decision-state only, never authoritative consent, entitlements or sending authorization. No production adapter is mounted.';
commit;
