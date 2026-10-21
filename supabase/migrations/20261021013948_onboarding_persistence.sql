begin;
alter table public.learnme_preferences add column revision integer not null default 1;
create function public.bump_learnme_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.revision:=old.revision+1; return new; end $$;
revoke all on function public.bump_learnme_revision() from public,anon,authenticated;
create trigger bump_style_revision before update on public.learnme_preferences for each row execute function public.bump_learnme_revision();
create table public.onboarding_states (
  id uuid primary key,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  relationship_id uuid,
  state jsonb not null default '{}'::jsonb,
  revision integer not null default 1 check(revision>0),
  updated_at timestamptz not null default now(),
  foreign key(relationship_id,sender_id) references public.relationships(id,sender_id),
  unique(relationship_id),
  check(jsonb_typeof(state)='object' and octet_length(state::text)<20000),
  check(not(state ?| array['example1','example2','learn','drafts','approved','freeUsed']))
);
create index onboarding_sender_idx on public.onboarding_states(sender_id);
alter table public.onboarding_states enable row level security;
revoke all on public.onboarding_states from public,anon,authenticated;
grant select,insert,update on public.onboarding_states to authenticated;
grant all on public.onboarding_states to service_role;
create policy own_read on public.onboarding_states for select to authenticated using(sender_id=(select auth.uid()));
create policy own_insert on public.onboarding_states for insert to authenticated with check(sender_id=(select auth.uid()));
create policy own_update on public.onboarding_states for update to authenticated using(sender_id=(select auth.uid())) with check(sender_id=(select auth.uid()));

create table public.learnme_examples (
  sender_id uuid not null references public.learnme_preferences(sender_id) on delete cascade,
  slot integer not null check(slot in (1,2)),
  content text not null check(length(content) between 1 and 4000),
  primary key(sender_id,slot)
);
alter table public.learnme_examples enable row level security;
revoke all on public.learnme_examples from public,anon,authenticated;
grant select,insert,delete on public.learnme_examples to authenticated;
grant all on public.learnme_examples to service_role;
create policy own_read on public.learnme_examples for select to authenticated using(sender_id=(select auth.uid()) and exists(select 1 from public.learnme_preferences p where p.sender_id=learnme_examples.sender_id and p.enabled));
create policy own_insert on public.learnme_examples for insert to authenticated with check(sender_id=(select auth.uid()) and exists(select 1 from public.learnme_preferences p where p.sender_id=learnme_examples.sender_id and p.enabled));
create policy own_delete on public.learnme_examples for delete to authenticated using(sender_id=(select auth.uid()));
create or replace function public.clear_learnme_history() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if not new.enabled then
    delete from public.learnme_history where sender_id=new.sender_id;
    delete from public.learnme_examples where sender_id=new.sender_id;
  end if;
  return new;
end $$;
-- Serialize style writes against opt-out, including direct Data API writes.
create function public.guard_style_write() returns trigger language plpgsql security invoker set search_path='' as $$
declare enabled_now boolean;
begin
  select enabled into enabled_now from public.learnme_preferences where sender_id=new.sender_id for update;
  if enabled_now is distinct from true then raise exception 'LearnMe opt-in required'; end if;
  return new;
end $$;
revoke all on function public.guard_style_write() from public,anon,authenticated;
create trigger guard_examples before insert on public.learnme_examples for each row execute function public.guard_style_write();
create trigger guard_history before insert on public.learnme_history for each row execute function public.guard_style_write();

grant update(display_name,phone) on public.recipients to authenticated;
create policy own_update on public.recipients for update to authenticated using(sender_id=(select auth.uid())) with check(sender_id=(select auth.uid()));
grant update(kind) on public.relationships to authenticated;
create policy own_update on public.relationships for update to authenticated using(sender_id=(select auth.uid())) with check(sender_id=(select auth.uid()));
create function public.guard_recipient_phone() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.phone is distinct from old.phone and exists(select 1 from public.relationships r join public.consent_events e on e.relationship_id=r.id where r.recipient_id=old.id) then
    raise exception 'A phone with consent history requires a verified recipient replacement';
  end if;
  return new;
end $$;
revoke all on function public.guard_recipient_phone() from public,anon,authenticated;
create trigger guard_phone before update on public.recipients for each row execute function public.guard_recipient_phone();

create function public.save_onboarding(record_id uuid, expected_revision integer, payload jsonb, learn_enabled boolean, examples jsonb, expected_learnme_revision integer, existing_relationship_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare sender uuid:=auth.uid(); current_row public.onboarding_states; related uuid; recipient uuid; result public.onboarding_states; key text; item jsonb; pos integer:=0;
begin
  if sender is null then raise exception 'Sign in required'; end if;
  if record_id is null or expected_revision is null or expected_revision<0 or learn_enabled is null then raise exception 'Invalid save request'; end if;
  if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>18000 then raise exception 'Invalid onboarding data'; end if;
  for key in select jsonb_object_keys(payload) loop
    if not(key=any(array['plan','mode','step','name','relationship','other','phone','feel','tone','traits','describe','topics','faith','faithOther','length','limits','frequency','days','timing','window','timezone','occasions','repeat','batch'])) then raise exception 'Unsupported onboarding field'; end if;
  end loop;
  if payload->>'plan' is null or payload->>'plan' not in ('Free','Essential','Plus') or payload->>'mode' is null or payload->>'mode' not in ('my','care') then raise exception 'Invalid plan preference or mode'; end if;
  if payload->>'mode'='care' and payload->>'plan'='Free' then raise exception 'CareTouch requires a paid plan selection; delivery remains inactive'; end if;
  if payload->>'mode'='care' and payload->>'frequency'='Daily' and payload->>'plan'<>'Plus' then raise exception 'Daily CareTouch requires Plus'; end if;
  if jsonb_typeof(payload->'step') is distinct from 'number' or (payload->>'step')::integer not between 0 and 5 then raise exception 'Invalid step'; end if;
  foreach key in array array['feel','tone','traits','topics','days'] loop
    if jsonb_typeof(payload->key) is distinct from 'array' or jsonb_array_length(payload->key)>7 then raise exception 'Invalid choices'; end if;
    for item in select value from jsonb_array_elements(payload->key) loop
      if jsonb_typeof(item)<>'string' or length(item::text)>100 then raise exception 'Invalid choice value'; end if;
    end loop;
  end loop;
  if examples is null or jsonb_typeof(examples)<>'array' or jsonb_array_length(examples)>2 then raise exception 'At most two writing examples'; end if;
  insert into public.profiles(id) values(sender) on conflict do nothing;
  perform id from public.profiles where id=sender for update;
  perform sender_id from public.learnme_preferences where sender_id=sender for update;
  if expected_learnme_revision is null or coalesce((select revision from public.learnme_preferences where sender_id=sender),0)<>expected_learnme_revision then raise exception 'LearnMe changed in another tab. Reload before saving.'; end if;
  select * into current_row from public.onboarding_states where id=record_id for update;
  if found then
    if current_row.revision<>expected_revision then raise exception 'This setup changed in another tab. Reload before saving.'; end if;
    related:=current_row.relationship_id;
  elsif expected_revision<>0 then raise exception 'Setup no longer available';
  elsif existing_relationship_id is not null then
    select id into related from public.relationships where id=existing_relationship_id;
    if related is null then raise exception 'Relationship unavailable'; end if;
  end if;
  if length(trim(coalesce(payload->>'name','')))>0 then
    if related is null then
      related:=public.create_relationship(trim(payload->>'name'),payload->>'relationship',nullif(trim(payload->>'phone'),''));
    else
      select recipient_id into recipient from public.relationships where id=related;
      update public.recipients set display_name=trim(payload->>'name'),phone=nullif(trim(payload->>'phone'),'') where id=recipient;
      update public.relationships set kind=payload->>'relationship' where id=related;
    end if;
  elsif related is not null then raise exception 'Loved one name is required'; end if;
  insert into public.learnme_preferences(sender_id,enabled,policy_version,opted_in_at)
    values(sender,learn_enabled,case when learn_enabled then 'learnme-v1' end,case when learn_enabled then now() end)
    on conflict(sender_id) do update set enabled=excluded.enabled,policy_version=excluded.policy_version,opted_in_at=case when public.learnme_preferences.enabled and excluded.enabled then public.learnme_preferences.opted_in_at else excluded.opted_in_at end;
  delete from public.learnme_examples where sender_id=sender;
  if learn_enabled then
    for item in select value from jsonb_array_elements(examples) loop
      pos:=pos+1;
      if jsonb_typeof(item)<>'string' then raise exception 'Invalid example'; end if;
      if length(trim(item#>>'{}'))>0 then insert into public.learnme_examples(sender_id,slot,content) values(sender,pos,item#>>'{}'); end if;
    end loop;
  end if;
  insert into public.onboarding_states(id,sender_id,relationship_id,state,revision)
    values(record_id,sender,related,payload,1)
    on conflict(id) do update set state=excluded.state,relationship_id=excluded.relationship_id,revision=public.onboarding_states.revision+1,updated_at=now()
    returning * into result;
  return to_jsonb(result)||jsonb_build_object('learnme_revision',(select revision from public.learnme_preferences where sender_id=sender));
end $$;
revoke all on function public.save_onboarding(uuid,integer,jsonb,boolean,jsonb,integer,uuid) from public,anon;
grant execute on function public.save_onboarding(uuid,integer,jsonb,boolean,jsonb,integer,uuid) to authenticated;
commit;
