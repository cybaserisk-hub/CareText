-- Executable foundation. Do not run the old architecture/db/001_autopilot starter.
begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check(length(display_name)<=100),
  created_at timestamptz not null default now()
);
create table public.plan_allowances (
  plan text primary key check(plan in ('Free','Essential','Plus')),
  monthly_price_cents integer not null,
  active_recipient_limit integer,
  monthly_sms integer not null,
  monthly_ai integer,
  daily_caretouch boolean not null
);
insert into public.plan_allowances values ('Free',0,null,0,5,false),('Essential',499,1,15,null,false),('Plus',999,5,100,null,true);
create table public.subscriptions (
  sender_id uuid primary key references public.profiles(id) on delete cascade,
  plan text not null default 'Free' references public.plan_allowances(plan),
  status text not null default 'inactive' check(status in ('inactive','active','past_due','cancelled')),
  billing_interval text check(billing_interval in ('monthly','annual')),
  provider_subscription_id text unique,
  next_billing_at timestamptz,
  initial_purchase_at timestamptz
);
create table public.recipients (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null check(length(trim(display_name)) between 1 and 100),
  phone text check(phone ~ '^\+[1-9][0-9]{7,14}$'),
  created_at timestamptz not null default now(),
  unique(id,sender_id)
);
create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null,
  kind text not null check(kind in ('Spouse','Parent','Friend','Sibling','Anyone','Other')),
  caretouch_active boolean not null default false check(caretouch_active = false),
  created_at timestamptz not null default now(),
  foreign key(recipient_id,sender_id) references public.recipients(id,sender_id) on delete cascade,
  unique(sender_id,recipient_id), unique(id,sender_id)
);
create table public.consent_events (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null,
  relationship_id uuid not null,
  event_type text not null check(event_type in ('invited','verified','declined','opted_out','disclosed')),
  phone text not null check(phone ~ '^\+[1-9][0-9]{7,14}$'),
  policy_version text not null,
  provider_event_id text not null unique,
  created_at timestamptz not null default now(),
  foreign key(relationship_id,sender_id) references public.relationships(id,sender_id)
);
create table public.learnme_preferences (
  sender_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  policy_version text,
  opted_in_at timestamptz,
  check(not enabled or (policy_version is not null and opted_in_at is not null))
);
create table public.learnme_history (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.learnme_preferences(sender_id) on delete cascade,
  content text not null check(length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);
create table public.message_drafts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null,
  relationship_id uuid not null,
  content text not null check(length(content) between 1 and 480),
  created_at timestamptz not null default now(),
  foreign key(relationship_id,sender_id) references public.relationships(id,sender_id),
  unique(id,sender_id)
);
-- An approval is an immutable snapshot; editing a draft cannot silently approve new text.
create table public.message_approvals (
  id uuid primary key default gen_random_uuid(), sender_id uuid not null,
  draft_id uuid not null, approved_content text not null,
  approved_at timestamptz not null default now(),
  foreign key(draft_id,sender_id) references public.message_drafts(id,sender_id)
);
create table public.usage_periods (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id),
  starts_at timestamptz not null, ends_at timestamptz not null,
  sms_used integer not null default 0 check(sms_used>=0),
  ai_used integer not null default 0 check(ai_used>=0),
  check(ends_at>starts_at), unique(sender_id,starts_at)
);
create table public.replacement_audit (
  id uuid primary key default gen_random_uuid(), sender_id uuid not null,
  old_relationship_id uuid not null, new_relationship_id uuid not null,
  reason text not null check(reason in ('voluntary','declined','opted_out','incorrect_number')),
  verified_exception_at timestamptz, completed_at timestamptz not null default now(),
  check(old_relationship_id <> new_relationship_id),
  check(reason='voluntary' or verified_exception_at is not null),
  foreign key(old_relationship_id,sender_id) references public.relationships(id,sender_id),
  foreign key(new_relationship_id,sender_id) references public.relationships(id,sender_id)
);
create table public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id),
  reason text not null check(length(trim(reason)) between 1 and 2000),
  status text not null default 'requested' check(status in ('requested','reviewing','approved','declined')),
  created_at timestamptz not null default now()
);
create table public.autopilot_settings (
  relationship_id uuid primary key, sender_id uuid not null,
  mode text not null default 'manual' check(mode in ('manual','paused')),
  opted_in_at timestamptz, policy_version text, eligible_at timestamptz,
  profile_revision integer not null default 1,
  approved_profile_revision integer, pause_reason text,
  foreign key(relationship_id,sender_id) references public.relationships(id,sender_id)
);
create table public.autopilot_events (
  id uuid primary key default gen_random_uuid(), sender_id uuid not null,
  relationship_id uuid not null, event_type text not null,
  created_at timestamptz not null default now(),
  foreign key(relationship_id,sender_id) references public.relationships(id,sender_id)
);
-- Explicit grants override potentially permissive Supabase default privileges.
do $$ declare t text; begin
  foreach t in array array['profiles','plan_allowances','subscriptions','recipients','relationships','consent_events','learnme_preferences','learnme_history','message_drafts','message_approvals','usage_periods','replacement_audit','refund_requests','autopilot_settings','autopilot_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    if t not in ('profiles','plan_allowances') then
      execute format('create policy own_read on public.%I for select to authenticated using (sender_id = (select auth.uid()))',t);
      execute format('create index on public.%I(sender_id)',t);
    end if;
  end loop;
end $$;
create policy own_read on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy plan_read on public.plan_allowances for select to authenticated using(true);
grant insert(id), update(display_name) on public.profiles to authenticated;
create policy own_insert on public.profiles for insert to authenticated with check(id=(select auth.uid()));
create policy own_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
grant insert(sender_id,display_name,phone) on public.recipients to authenticated;
create policy own_insert on public.recipients for insert to authenticated with check(sender_id=(select auth.uid()));
grant insert(sender_id,recipient_id,kind) on public.relationships to authenticated;
create policy own_insert on public.relationships for insert to authenticated with check(sender_id=(select auth.uid()));
grant insert(sender_id,enabled,policy_version,opted_in_at), update(enabled,policy_version,opted_in_at) on public.learnme_preferences to authenticated;
create policy own_insert on public.learnme_preferences for insert to authenticated with check(sender_id=(select auth.uid()));
create policy own_update on public.learnme_preferences for update to authenticated using(sender_id=(select auth.uid())) with check(sender_id=(select auth.uid()));
grant insert(sender_id,content), delete on public.learnme_history to authenticated;
create policy own_insert on public.learnme_history for insert to authenticated with check(sender_id=(select auth.uid()) and exists(select 1 from public.learnme_preferences p where p.sender_id=learnme_history.sender_id and p.enabled));
create policy own_delete on public.learnme_history for delete to authenticated using(sender_id=(select auth.uid()));
grant insert(sender_id,relationship_id,content), update(content) on public.message_drafts to authenticated;
create policy own_insert on public.message_drafts for insert to authenticated with check(sender_id=(select auth.uid()));
create policy own_update on public.message_drafts for update to authenticated using(sender_id=(select auth.uid())) with check(sender_id=(select auth.uid()));
grant insert(sender_id,draft_id,approved_content) on public.message_approvals to authenticated;
create policy own_insert on public.message_approvals for insert to authenticated with check(sender_id=(select auth.uid()) and exists(select 1 from public.message_drafts d where d.id=draft_id and d.sender_id=message_approvals.sender_id and d.content=approved_content));
grant insert(sender_id,reason) on public.refund_requests to authenticated;
create policy own_insert on public.refund_requests for insert to authenticated with check(sender_id=(select auth.uid()));

-- Invoker RPC is atomic and derives ownership from the JWT, never a browser-supplied ID.
create function public.create_relationship(display_name text, kind text, phone text default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare recipient uuid; relationship uuid; sender uuid := auth.uid();
begin
  if sender is null then raise exception 'Sign in required'; end if;
  insert into public.profiles(id) values(sender) on conflict do nothing;
  insert into public.recipients(sender_id,display_name,phone) values(sender,display_name,phone) returning id into recipient;
  insert into public.relationships(sender_id,recipient_id,kind) values(sender,recipient,kind) returning id into relationship;
  return relationship;
end $$;
revoke all on function public.create_relationship(text,text,text) from public, anon;
grant execute on function public.create_relationship(text,text,text) to authenticated;
-- Opting out deletes saved style history in the same transaction.
create function public.clear_learnme_history() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if not new.enabled then delete from public.learnme_history where sender_id=new.sender_id; end if;
  return new;
end $$;
revoke all on function public.clear_learnme_history() from public, anon, authenticated;
create trigger clear_style after update of enabled on public.learnme_preferences for each row execute function public.clear_learnme_history();
commit;
