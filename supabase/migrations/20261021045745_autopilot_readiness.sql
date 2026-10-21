begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Authoritative preparation records. No activation mode, scheduler or sender added.
create table private.autopilot_completed_batches(
 id uuid primary key default gen_random_uuid(),sender_id uuid not null references public.profiles(id),
 approval_ids uuid[] not null check(cardinality(approval_ids)>0),
 completed_at timestamptz not null default now(),completion_evidence text not null unique
);
create table private.autopilot_control_audit(
 id uuid primary key default gen_random_uuid(),sender_id uuid not null,relationship_id uuid not null,
 action text not null check(action in ('manual','paused')),created_at timestamptz not null default now(),
 foreign key(relationship_id,sender_id) references public.relationships(id,sender_id)
);
create table private.autopilot_notices(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references private.autopilot_control_audit(id),
 sender_id uuid not null references public.profiles(id),channel text not null check(channel in ('in_app','email')),
 status text not null default 'pending' check(status in ('pending','sent','failed')),
 unique(event_id,channel)
);
do $$declare t text;begin
 foreach t in array array['autopilot_completed_batches','autopilot_control_audit','autopilot_notices'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 execute format('grant select,insert on private.%I to service_role',t);
 end loop;
end $$;
-- Prevent reused or nonexistent human approvals from creating eligibility credit.
create function private.validate_completed_batch() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.completed_at>now() or length(new.completion_evidence)<16 or
 (select count(distinct x) from unnest(new.approval_ids) x)<>cardinality(new.approval_ids) or
 (select count(*) from public.message_approvals where id=any(new.approval_ids) and sender_id=new.sender_id and approved_at<=new.completed_at)<>cardinality(new.approval_ids)
 then raise exception 'Audited completed human batch required';end if;
 perform 1 from public.profiles where id=new.sender_id for update;
 if exists(select 1 from private.autopilot_completed_batches where sender_id=new.sender_id and approval_ids && new.approval_ids)
 then raise exception 'Approval already credited';end if;
 return new;
end $$;
create trigger completed_batch_validation before insert on private.autopilot_completed_batches for each row execute function private.validate_completed_batch();
revoke all on function private.validate_completed_batch() from public,anon,authenticated;

create function public.autopilot_readiness(action text,data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare rel public.relationships; sub public.subscriptions; setup public.onboarding_states; result jsonb; event uuid;
begin
 select * into rel from public.relationships where id=(data->>'relationship_id')::uuid and sender_id=(data->>'sender_id')::uuid;
 if not found then raise exception 'Relationship unavailable';end if;
 perform 1 from public.profiles where id=rel.sender_id for update;
 if action in ('manual','paused') then
  insert into public.autopilot_settings(relationship_id,sender_id,mode,pause_reason) values(rel.id,rel.sender_id,action,'Subscriber control; sending disabled')
   on conflict(relationship_id) do update set mode=excluded.mode,pause_reason=excluded.pause_reason;
  insert into private.autopilot_control_audit(sender_id,relationship_id,action) values(rel.sender_id,rel.id,action) returning id into event;
  insert into private.autopilot_notices(event_id,sender_id,channel) values(event,rel.sender_id,'in_app'),(event,rel.sender_id,'email');
 elsif action<>'status' then raise exception 'Autopilot activation disabled';end if;
 select * into sub from public.subscriptions where sender_id=rel.sender_id;
 select * into setup from public.onboarding_states where relationship_id=rel.id;
 result:=public.production_consent('eligibility',jsonb_build_object('relationship_id',rel.id));
 return jsonb_build_object('relationship_id',rel.id,'sender_id',rel.sender_id,
 'consent_eligible',coalesce((result->>'consent_eligible')::boolean,false),'consent_version',result->>'policy_version',
 'plan',sub.plan,'subscription_status',sub.status,'profile_revision',setup.revision,
 'completed_batches',(select count(*) from private.autopilot_completed_batches where sender_id=rel.sender_id),
 'mode',coalesce((select mode from public.autopilot_settings where relationship_id=rel.id),'manual'),
 'pending_notices',(select count(*) from private.autopilot_notices where sender_id=rel.sender_id and status='pending'),
 'live_enabled',false,'activation_allowed',false);
end $$;
revoke all on function public.autopilot_readiness(text,jsonb) from public,anon,authenticated;
grant execute on function public.autopilot_readiness(text,jsonb) to service_role;
commit;
