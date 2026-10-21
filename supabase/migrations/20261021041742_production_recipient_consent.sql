begin;
-- Production consent data is deliberately separate from all simulator evidence.
create table private.consent_rate_limits(key text primary key,window_start timestamptz not null default now(),requests integer not null default 0);
create table private.consent_invitations (
 id uuid primary key default gen_random_uuid(), token_hash text unique not null check(length(token_hash)=64),
 sender_id uuid not null, relationship_id uuid not null, recipient_id uuid not null,
 phone text not null, sender_name text not null, frequency text not null, setup_state jsonb not null,
 policy_version text not null, disclosure text not null, expires_at timestamptz not null default now()+interval '24 hours',
 status text not null default 'pending' check(status in ('pending','accepted','declined','revoked')),
 reservation text, verification_sid text, service_sid text, account_sid text, challenge_expires_at timestamptz,
 sends integer not null default 0, checks integer not null default 0,last_sent_at timestamptz,last_check_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key(relationship_id,sender_id) references public.relationships(id,sender_id),
 foreign key(recipient_id,sender_id) references public.recipients(id,sender_id)
);
create table private.recipient_suppression(phone text primary key,blocked boolean not null default false,updated_at timestamptz not null default now());
create table private.relationship_consent(
 relationship_id uuid primary key, sender_id uuid not null,recipient_id uuid not null,phone text not null,
 invitation_id uuid not null references private.consent_invitations(id),
 state text not null check(state in ('granted','withdrawn','revoked')),
 granted_at timestamptz not null,changed_at timestamptz not null default now(),
 foreign key(relationship_id,sender_id) references public.relationships(id,sender_id)
);
create table private.consent_evidence(
 id uuid primary key default gen_random_uuid(),invitation_id uuid not null references private.consent_invitations(id),
 sender_id uuid not null,recipient_id uuid not null,relationship_id uuid not null,phone text not null,
 event text not null,policy_version text not null,disclosure text not null,frequency text not null,
 verification_sid text,service_sid text,account_sid text,provider_status text,
 occurred_at timestamptz not null default now(), unique(invitation_id,event)
);
create unique index consent_provider_once on private.consent_evidence(verification_sid) where event='granted';
create table private.consent_inbound(
 message_sid text primary key,phone text not null,kind text not null,body text,help_preview text,
 routing text not null default 'unresolved',created_at timestamptz not null default now()
);
create table public.recipient_replies(
 message_sid text primary key references private.consent_inbound(message_sid),sender_id uuid not null,
 relationship_id uuid not null,body text not null,created_at timestamptz not null default now(),
 foreign key(relationship_id,sender_id) references public.relationships(id,sender_id)
);
create table private.consent_outbound(
 message_sid text primary key,relationship_id uuid not null references public.relationships(id),phone text not null,
 status text not null default 'queued',updated_at timestamptz not null default now()
);
create index consent_invitation_sender on private.consent_invitations(sender_id,created_at);
create index consent_phone on private.relationship_consent(phone);
create index consent_outbound_phone on private.consent_outbound(phone);
do $$declare t text;begin
 foreach t in array array['consent_rate_limits','consent_invitations','recipient_suppression','relationship_consent','consent_evidence','consent_inbound','consent_outbound'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated',t);
 execute format('grant select,insert on private.%I to service_role',t);
 if t<>'consent_evidence' then execute format('grant update on private.%I to service_role',t);end if;
 end loop;
end $$;
alter table public.recipient_replies enable row level security;
revoke all on public.recipient_replies from public,anon,authenticated;
grant select on public.recipient_replies to authenticated;
grant select,insert on public.recipient_replies to service_role;
create policy own_read on public.recipient_replies for select to authenticated using(sender_id=(select auth.uid()));
-- Only the service-role RPC can activate, after recorded consent and entitlement.
alter table public.relationships drop constraint relationships_caretouch_active_check;

create function private.require_verified_activation() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if not new.caretouch_active then return new;end if;
 if not exists(
  select 1 from private.relationship_consent c join private.consent_invitations inv on inv.id=c.invitation_id
  join public.recipients rec on rec.id=c.recipient_id join public.onboarding_states os on os.relationship_id=c.relationship_id
  join public.subscriptions sub on sub.sender_id=c.sender_id join public.plan_allowances p on p.plan=sub.plan
  where c.relationship_id=new.id and c.sender_id=new.sender_id and c.state='granted' and c.phone=rec.phone
  and inv.verification_sid is not null and inv.setup_state=os.state and sub.status='active' and sub.plan in ('Essential','Plus')
  and (inv.frequency<>'Daily' or p.daily_caretouch)
  and (select count(*) from public.relationships r where r.sender_id=new.sender_id and r.caretouch_active and r.id<>new.id)<p.active_recipient_limit
  and not exists(select 1 from private.recipient_suppression sp where sp.phone=c.phone and sp.blocked)
 ) then raise exception 'Verified eligible consent required';end if;
 return new;
end $$;
revoke all on function private.require_verified_activation() from public,anon,authenticated;
grant execute on function private.require_verified_activation() to service_role;
create trigger require_verified_activation before insert or update of caretouch_active on public.relationships for each row execute function private.require_verified_activation();

create function public.production_consent(action text,data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare i private.consent_invitations; r record; sub record; prior private.relationship_consent;
 result jsonb; blocked boolean; n integer; target uuid; old_status text; event_name text;
begin
 if action='rate' then
  insert into private.consent_rate_limits(key) values(data->>'key') on conflict do nothing;
  perform 1 from private.consent_rate_limits where key=data->>'key' for update;
  update private.consent_rate_limits set requests=case when window_start<now()-interval '1 minute' then 1 else requests+1 end,window_start=case when window_start<now()-interval '1 minute' then now() else window_start end where key=data->>'key' returning requests into n;
  return case when n>30 then jsonb_build_object('error','Request limit') else jsonb_build_object('ok',true) end;
 elsif action='create' then
  perform 1 from public.profiles where id=(data->>'sender_id')::uuid for update;
  if not found then return jsonb_build_object('error','Account unavailable');end if;
  select rel.*,rec.phone,p.display_name,os.state into r from public.relationships rel
   join public.recipients rec on rec.id=rel.recipient_id and rec.sender_id=rel.sender_id
   join public.profiles p on p.id=rel.sender_id join public.onboarding_states os on os.relationship_id=rel.id
   where rel.id=(data->>'relationship_id')::uuid and rel.sender_id=(data->>'sender_id')::uuid;
  if not found or r.phone is null or length(trim(r.display_name))=0 or r.state->>'mode' is distinct from 'care'
   or coalesce(r.state->>'frequency','') not in ('Daily','Weekly','Three times weekly','Monthly') then return jsonb_build_object('error','Save subscriber name and CareTouch setup first');end if;
  if (select count(*) from private.consent_invitations where sender_id=r.sender_id and created_at>now()-interval '1 hour')>=10 then return jsonb_build_object('error','Invitation limit reached');end if;
  update private.consent_invitations set status='revoked' where relationship_id=r.id and status='pending';
  insert into private.consent_invitations(token_hash,sender_id,relationship_id,recipient_id,phone,sender_name,frequency,setup_state,policy_version,disclosure)
  values(data->>'token_hash',r.sender_id,r.id,r.recipient_id,r.phone,r.display_name,r.state->>'frequency',r.state,data->>'policy_version',data->>'disclosure') returning * into i;
  return jsonb_build_object('id',i.id,'expires_at',i.expires_at);
 elsif action='inbound' then
  insert into private.recipient_suppression(phone) values(data->>'phone') on conflict do nothing;
  perform 1 from private.recipient_suppression where phone=data->>'phone' for update;
  insert into private.consent_inbound(message_sid,phone,kind,body,help_preview)
   values(data->>'message_sid',data->>'phone',data->>'kind',case when data->>'kind'='REPLY' then left(data->>'body',1600) end,data->>'help_preview') on conflict do nothing;
  get diagnostics n=row_count;if n=0 then return jsonb_build_object('duplicate',true);end if;
  if data->>'kind'='STOP' then
   update private.recipient_suppression set blocked=true,updated_at=now() where phone=data->>'phone';
   update public.relationships set caretouch_active=false where id in(select relationship_id from private.relationship_consent where phone=data->>'phone');
   update private.relationship_consent set state='withdrawn',changed_at=now() where phone=data->>'phone';
   update private.consent_outbound set status='canceled',updated_at=now() where phone=data->>'phone' and status in ('queued','accepted','scheduled');
   insert into private.consent_evidence(invitation_id,sender_id,recipient_id,relationship_id,phone,event,policy_version,disclosure,frequency)
    select id,sender_id,recipient_id,relationship_id,phone,'STOP:'||(data->>'message_sid'),policy_version,disclosure,frequency from private.consent_invitations where id in(select invitation_id from private.relationship_consent where phone=data->>'phone') on conflict do nothing;
  elsif data->>'kind'='REPLY' then
   select count(*),min(c.relationship_id::text)::uuid into n,target from private.relationship_consent c
    join public.relationships rel on rel.id=c.relationship_id join public.recipients rec on rec.id=c.recipient_id
    join public.onboarding_states os on os.relationship_id=rel.id join private.consent_invitations inv on inv.id=c.invitation_id
    where c.phone=data->>'phone' and c.state='granted' and rel.caretouch_active and rec.phone=c.phone and os.state=inv.setup_state;
   select s.blocked into blocked from private.recipient_suppression s where phone=data->>'phone';
   if n=1 and not blocked then
    insert into public.recipient_replies(message_sid,sender_id,relationship_id,body) select data->>'message_sid',sender_id,relationship_id,left(data->>'body',1600) from private.relationship_consent where relationship_id=target;
    update private.consent_inbound set routing='routed' where message_sid=data->>'message_sid';
   else update private.consent_inbound set routing=case when n>1 then 'ambiguous' else 'unmatched' end where message_sid=data->>'message_sid';end if;
  end if;
  -- START never restores consent or removes suppression. HELP is recorded, not sent.
  return jsonb_build_object('ok',true);
 elsif action='status' then
  select status into old_status from private.consent_outbound where message_sid=data->>'message_sid' and phone=data->>'phone' for update;
  if not found then return jsonb_build_object('error','Unknown message');end if;
  if old_status not in ('delivered','undelivered','failed','canceled') and array_position(array['accepted','scheduled','queued','sending','sent','delivered','undelivered','failed','canceled'],data->>'status')>=array_position(array['accepted','scheduled','queued','sending','sent','delivered','undelivered','failed','canceled'],old_status) then
   update private.consent_outbound set status=data->>'status',updated_at=now() where message_sid=data->>'message_sid';end if;
  return jsonb_build_object('ok',true);
 elsif action='eligibility' then
  select c.*,rec.phone as current_phone,rel.caretouch_active,os.state as setup,inv.setup_state into r from private.relationship_consent c
   join public.relationships rel on rel.id=c.relationship_id join public.recipients rec on rec.id=c.recipient_id
   join private.consent_invitations inv on inv.id=c.invitation_id join public.onboarding_states os on os.relationship_id=c.relationship_id
   where c.relationship_id=(data->>'relationship_id')::uuid;
  if not found then return jsonb_build_object('consent_eligible',false,'delivery_allowed',false,'reason','No consent; delivery disabled');end if;
  select s.*,p.active_recipient_limit,p.daily_caretouch into sub from public.subscriptions s join public.plan_allowances p on p.plan=s.plan where sender_id=r.sender_id;
  return jsonb_build_object('consent_eligible',coalesce(r.state='granted' and r.phone=r.current_phone and r.setup=r.setup_state and r.caretouch_active and sub.status='active' and sub.plan in ('Essential','Plus') and (select count(*) from public.relationships where sender_id=r.sender_id and caretouch_active)<=sub.active_recipient_limit and (r.setup->>'frequency'<>'Daily' or sub.daily_caretouch) and not exists(select 1 from private.recipient_suppression sp where sp.phone=r.phone and sp.blocked),false),'delivery_allowed',false,'reason','CareTouch delivery remains disabled');
 end if;
 select * into i from private.consent_invitations where token_hash=data->>'token_hash';
 if not found then return jsonb_build_object('error','Invitation unavailable');end if;
 -- Shared phone lock serializes acceptance against STOP and across senders.
 insert into private.recipient_suppression(phone) values(i.phone) on conflict do nothing;
 select s.blocked into blocked from private.recipient_suppression s where s.phone=i.phone for update;
 perform 1 from public.profiles where id=i.sender_id for update;
 select * into i from private.consent_invitations where id=i.id for update;
 if action='revoke' and (data->>'sender_id')::uuid is distinct from i.sender_id then return jsonb_build_object('error','Invitation unavailable');end if;
 if action in ('revoke','withdraw') then
  event_name:=case action when 'withdraw' then 'withdrawn' else 'revoked' end;
  update private.relationship_consent set state=event_name,changed_at=now() where relationship_id=i.relationship_id and invitation_id=i.id;
  update public.relationships set caretouch_active=false where id=i.relationship_id and exists(select 1 from private.relationship_consent where invitation_id=i.id and relationship_id=i.relationship_id);
  update private.consent_outbound set status='canceled' where relationship_id=i.relationship_id and status in ('queued','accepted','scheduled') and exists(select 1 from private.relationship_consent where relationship_id=i.relationship_id and invitation_id=i.id);
  update private.consent_invitations set status='revoked' where id=i.id;
 elsif i.expires_at<=now() then return jsonb_build_object('error','Invitation expired');
 elsif not exists(select 1 from public.recipients rec join public.onboarding_states os on os.relationship_id=i.relationship_id where rec.id=i.recipient_id and rec.phone=i.phone and os.state=i.setup_state) then return jsonb_build_object('error','Setup changed; request a new invitation');
 elsif action='view' then return jsonb_build_object('sender',i.sender_name,'frequency',i.frequency,'phone_hint','ending in '||right(i.phone,4),'policy_version',i.policy_version,'disclosure',i.disclosure,'status',i.status,'test_only',false);
 elsif action='accept' and i.status='accepted' then return jsonb_build_object('ok',true,'status','accepted','duplicate',true);
 elsif i.status<>'pending' then return jsonb_build_object('error','Invitation completed');
 elsif action='decline' then update private.consent_invitations set status='declined' where id=i.id;event_name:='declined';
 elsif blocked then return jsonb_build_object('error','Recipient suppressed; support review required');
 elsif action='reserve' then
  select s.*,p.active_recipient_limit,p.daily_caretouch into sub from public.subscriptions s join public.plan_allowances p on p.plan=s.plan where s.sender_id=i.sender_id;
  if not found or sub.status<>'active' or sub.plan='Free' or (i.frequency='Daily' and not sub.daily_caretouch) then return jsonb_build_object('error','Eligible paid plan required');end if;
  if (select count(*) from public.relationships where sender_id=i.sender_id and caretouch_active and id<>i.relationship_id)>=sub.active_recipient_limit then return jsonb_build_object('error','Recipient plan limit');end if;
  if data->>'phone' is distinct from i.phone then return jsonb_build_object('error','Phone does not match');end if;
  if i.sends>=3 or i.last_sent_at>now()-interval '60 seconds' or (select coalesce(sum(sends),0) from private.consent_invitations where phone=i.phone and last_sent_at>now()-interval '1 hour')>=5 then return jsonb_build_object('error','Verification request limit');end if;
  update private.consent_invitations set sends=sends+1,last_sent_at=now(),reservation=data->>'reservation',verification_sid=null,challenge_expires_at=now()+interval '10 minutes' where id=i.id;
  return jsonb_build_object('phone',i.phone);
 elsif action='attach' then
  if i.reservation is distinct from data->>'reservation' or coalesce(data->>'verification_sid','')!~'^VE[0-9a-fA-F]{32}$' then return jsonb_build_object('error','Challenge changed');end if;
  update private.consent_invitations set verification_sid=data->>'verification_sid',service_sid=data->>'service_sid',account_sid=data->>'account_sid' where id=i.id;return jsonb_build_object('ok',true);
 elsif action in ('check','accept') then
  if data->'affirmative' is distinct from 'true'::jsonb or data->>'policy_version' is distinct from i.policy_version then return jsonb_build_object('error','Affirmative consent required');end if;
  if i.verification_sid is null or i.challenge_expires_at<=now() then return jsonb_build_object('error','Verification expired');end if;
  if action='check' then
   if i.checks>=5 or i.last_check_at>now()-interval '2 seconds' then return jsonb_build_object('error','Check limit');end if;
   update private.consent_invitations set checks=checks+1,last_check_at=now() where id=i.id;
   return jsonb_build_object('phone',i.phone,'verification_sid',i.verification_sid,'reservation',i.reservation);
  end if;
  if data->>'reservation' is distinct from i.reservation or data->>'verification_sid' is distinct from i.verification_sid or data->>'provider_status' is distinct from 'approved' then return jsonb_build_object('error','Provider approval required');end if;
  select s.*,p.active_recipient_limit,p.daily_caretouch into sub from public.subscriptions s join public.plan_allowances p on p.plan=s.plan where s.sender_id=i.sender_id;
  if not found or sub.status<>'active' or sub.plan='Free' or (i.frequency='Daily' and not sub.daily_caretouch) then return jsonb_build_object('error','Eligible paid plan required');end if;
  if (select count(*) from public.relationships where sender_id=i.sender_id and caretouch_active and id<>i.relationship_id)>=sub.active_recipient_limit then return jsonb_build_object('error','Recipient plan limit');end if;
  -- Reusing a freed slot is a replacement, not a way around the rolling policy.
  select * into prior from private.relationship_consent c where c.sender_id=i.sender_id and c.relationship_id<>i.relationship_id and c.state<>'granted'
   and not exists(select 1 from public.replacement_audit a where a.old_relationship_id=c.relationship_id and a.completed_at>=c.changed_at) order by c.changed_at limit 1;
  if found then
   if prior.state<>'withdrawn' and exists(select 1 from public.replacement_audit where sender_id=i.sender_id and reason='voluntary' and completed_at>now()-interval '30 days') then return jsonb_build_object('error','Rolling recipient replacement limit');end if;
   insert into public.replacement_audit(sender_id,old_relationship_id,new_relationship_id,reason,verified_exception_at) values(i.sender_id,prior.relationship_id,i.relationship_id,case when prior.state='withdrawn' then 'opted_out' else 'voluntary' end,case when prior.state='withdrawn' then now() end);
  end if;
  insert into private.relationship_consent(relationship_id,sender_id,recipient_id,phone,invitation_id,state,granted_at) values(i.relationship_id,i.sender_id,i.recipient_id,i.phone,i.id,'granted',now()) on conflict(relationship_id) do update set phone=excluded.phone,invitation_id=excluded.invitation_id,state='granted',granted_at=now(),changed_at=now();
  update public.relationships set caretouch_active=true where id=i.relationship_id;
  update private.consent_invitations set status='accepted' where id=i.id;event_name:='granted';
 else return jsonb_build_object('error','Unsupported action');end if;
 insert into private.consent_evidence(invitation_id,sender_id,recipient_id,relationship_id,phone,event,policy_version,disclosure,frequency,verification_sid,service_sid,account_sid,provider_status)
 values(i.id,i.sender_id,i.recipient_id,i.relationship_id,i.phone,event_name,i.policy_version,i.disclosure,i.frequency,i.verification_sid,i.service_sid,i.account_sid,case when event_name='granted' then 'approved' end) on conflict do nothing;
 return jsonb_build_object('ok',true,'status',case when event_name='granted' then 'accepted' else event_name end,'delivery_allowed',false);
end $$;
revoke all on function public.production_consent(text,jsonb) from public,anon,authenticated;
grant execute on function public.production_consent(text,jsonb) to service_role;
commit;
