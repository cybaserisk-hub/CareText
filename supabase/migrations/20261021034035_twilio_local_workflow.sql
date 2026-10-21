begin;
-- Local provider-contract evidence only; never changes production consent/delivery.
create table private.twilio_test_verifications (
 token_hash text primary key references private.recipient_invitations(token_hash),
 reservation text not null, verification_sid text, checks integer not null default 0
);
create table private.twilio_test_suppression (
 phone text primary key, suppressed boolean not null default false, updated_at timestamptz not null default now()
);
create table private.twilio_test_events (
 event_key text primary key, kind text not null, phone text not null,
 message_sid text not null, body text, help_preview text, created_at timestamptz not null default now(),
 test_only boolean not null default true check(test_only)
);
create table private.twilio_test_messages (
 message_sid text primary key, phone text not null, status text not null default 'queued',
 test_only boolean not null default true check(test_only)
);
alter table private.twilio_test_verifications enable row level security;
alter table private.twilio_test_suppression enable row level security;
alter table private.twilio_test_events enable row level security;
alter table private.twilio_test_messages enable row level security;
revoke all on private.twilio_test_verifications,private.twilio_test_suppression,private.twilio_test_events,private.twilio_test_messages from public,anon,authenticated;
grant select,insert,update on private.twilio_test_verifications,private.twilio_test_suppression,private.twilio_test_messages to service_role;
grant select,insert on private.twilio_test_events to service_role;
create index twilio_test_messages_phone on private.twilio_test_messages(phone);
create function public.twilio_local_test(action text,data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare i private.recipient_invitations; v private.twilio_test_verifications; r jsonb; blocked boolean; inserted integer; old_status text;
begin
 if action in ('reserve','attach','check','accept') then
  r:=public.recipient_invitation_test('view',data);
  if r ? 'error' then return r; end if;
  select * into i from private.recipient_invitations where token_hash=data->>'token_hash' for update;
  if i.status<>'pending' then return jsonb_build_object('error','Invitation already completed'); end if;
  insert into private.twilio_test_suppression(phone) values(i.phone) on conflict do nothing;
  select suppressed into blocked from private.twilio_test_suppression where phone=i.phone for update;
  if blocked then return jsonb_build_object('error','Recipient opted out'); end if;
  if action='reserve' then
   if length(coalesce(data->>'reservation',''))<>64 then raise exception 'Invalid reservation'; end if;
   -- Existing RPC enforces bound phone, expiry, snapshot, cooldown and send cap.
   r:=public.recipient_invitation_test('challenge',data||jsonb_build_object('challenge_hash',data->>'reservation'));
   if r ? 'error' then return r; end if;
   insert into private.twilio_test_verifications(token_hash,reservation) values(i.token_hash,data->>'reservation')
    on conflict(token_hash) do update set reservation=excluded.reservation,verification_sid=null;
   return jsonb_build_object('phone',i.phone);
  end if;
  select * into v from private.twilio_test_verifications where token_hash=i.token_hash for update;
  if not found or i.challenge_expires_at<=now() then return jsonb_build_object('error','Verification expired'); end if;
  if action='attach' then
   if v.reservation is distinct from data->>'reservation' or data->>'verification_sid' is null or data->>'verification_sid' !~ '^VE[0-9a-fA-F]{32}$' then return jsonb_build_object('error','Verification changed'); end if;
   update private.twilio_test_verifications set verification_sid=data->>'verification_sid' where token_hash=i.token_hash;
   return jsonb_build_object('ok',true);
  end if;
  if v.verification_sid is null then return jsonb_build_object('error','Request verification first'); end if;
  if data->'affirmative' is distinct from 'true'::jsonb or data->>'policy_version' is distinct from i.policy_version then return jsonb_build_object('error','Affirmative consent to current disclosure required'); end if;
  if action='check' then
   if v.checks>=5 then return jsonb_build_object('error','Verification locked'); end if;
   update private.twilio_test_verifications set checks=checks+1 where token_hash=i.token_hash;
   return jsonb_build_object('phone',i.phone,'reservation',v.reservation,'verification_sid',v.verification_sid);
  end if;
  if v.reservation is distinct from data->>'reservation' or v.verification_sid is distinct from data->>'verification_sid' then return jsonb_build_object('error','Verification changed'); end if;
  return public.recipient_invitation_test('verify',data||jsonb_build_object('challenge_hash',v.reservation));
 elsif action='inbound' then
  insert into private.twilio_test_suppression(phone) values(data->>'phone') on conflict do nothing;
  perform 1 from private.twilio_test_suppression where phone=data->>'phone' for update;
  insert into private.twilio_test_events(event_key,kind,phone,message_sid,body,help_preview)
   values('inbound:'||(data->>'message_sid'),data->>'kind',data->>'phone',data->>'message_sid',case when data->>'kind'='REPLY' then left(data->>'body',1600) else null end,case when data->>'kind'='HELP' then data->>'help_preview' else null end)
   on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=0 then return jsonb_build_object('duplicate',true); end if;
  if data->>'kind'='STOP' then
   update private.twilio_test_suppression set suppressed=true,updated_at=now() where phone=data->>'phone';
   update private.twilio_test_messages set status='canceled' where phone=data->>'phone' and status in ('queued','accepted','scheduled');
  end if;
  -- START never clears suppression or grants consent. HELP never changes it.
  return jsonb_build_object('ok',true);
 elsif action='status' then
  select status into old_status from private.twilio_test_messages where message_sid=data->>'message_sid' and phone=data->>'phone' for update;
  if not found then return jsonb_build_object('error','Unknown outbound message'); end if;
  insert into private.twilio_test_events(event_key,kind,phone,message_sid)
   values('status:'||(data->>'message_sid')||':'||(data->>'status'),data->>'status',data->>'phone',data->>'message_sid') on conflict do nothing;
  if old_status not in ('delivered','undelivered','failed','canceled') and
    array_position(array['accepted','scheduled','queued','sending','sent','delivered','undelivered','failed','canceled'],data->>'status') >=
    array_position(array['accepted','scheduled','queued','sending','sent','delivered','undelivered','failed','canceled'],old_status) then
   update private.twilio_test_messages set status=data->>'status' where message_sid=data->>'message_sid';
  end if;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Unsupported action';
end $$;
revoke all on function public.twilio_local_test(text,jsonb) from public,anon,authenticated;
grant execute on function public.twilio_local_test(text,jsonb) to service_role;
commit;
