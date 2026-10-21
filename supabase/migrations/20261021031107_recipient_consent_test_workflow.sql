begin;
-- Private test evidence is intentionally separate from live consent_events.
create table private.recipient_invitations (
 id uuid primary key default gen_random_uuid(), sender_id uuid not null,
 relationship_id uuid not null, token_hash text unique not null check(length(token_hash)=64),
 phone text not null, sender_name text not null, frequency text not null,
 disclosure text not null, policy_version text not null,
 setup_revision integer not null, setup_state jsonb not null, expires_at timestamptz not null default now()+interval '24 hours',
 status text not null default 'pending' check(status in ('pending','accepted_test','declined','revoked')),
 challenge_hash text, challenge_expires_at timestamptz, attempts integer not null default 0,
 sends integer not null default 0, last_sent_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key(relationship_id,sender_id) references public.relationships(id,sender_id)
);
create table private.recipient_consent_test_events (
 id uuid primary key default gen_random_uuid(), invitation_id uuid not null references private.recipient_invitations(id),
 action text not null check(action in ('accepted_test','declined','revoked')),
 phone text not null, sender_id uuid not null, relationship_id uuid not null,
 disclosure text not null, policy_version text not null, frequency text not null,
 verification_method text not null default 'local_simulator', live_consent boolean not null default false check(not live_consent),
 created_at timestamptz not null default now(), unique(invitation_id,action)
);
alter table private.recipient_invitations enable row level security;
alter table private.recipient_consent_test_events enable row level security;
revoke all on private.recipient_invitations,private.recipient_consent_test_events from public,anon,authenticated;
grant usage on schema private to service_role;
grant select,insert,update on private.recipient_invitations to service_role;
grant select,insert on private.recipient_consent_test_events to service_role;
create index invitation_sender_created on private.recipient_invitations(sender_id,created_at);
create function public.recipient_invitation_test(action text, data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare i private.recipient_invitations; r record; sid uuid; result jsonb;
begin
 if action='create' then
  sid:=(data->>'sender_id')::uuid;
  perform 1 from public.profiles where id=sid for update;
  if not found then raise exception 'Account unavailable'; end if;
  if (select count(*) from private.recipient_invitations where sender_id=sid and created_at>now()-interval '1 hour')>=10 then raise exception 'Invitation limit reached'; end if;
  select rel.id, rec.phone, os.revision, os.state into r from public.relationships rel
   join public.recipients rec on rec.id=rel.recipient_id and rec.sender_id=rel.sender_id
   join public.onboarding_states os on os.relationship_id=rel.id and os.sender_id=rel.sender_id
   where rel.id=(data->>'relationship_id')::uuid and rel.sender_id=sid;
  if not found or r.phone is null or coalesce(r.state->>'mode','') <> 'care' or coalesce(r.state->>'frequency','') not in ('Daily','Weekly','Three times weekly','Monthly') then raise exception 'Save a CareTouch setup with a phone and schedule first'; end if;
  if length(trim(coalesce(data->>'sender_name',''))) not between 1 and 254 then raise exception 'Sender identity required'; end if;
  update private.recipient_invitations set status='revoked',challenge_hash=null where relationship_id=r.id and status='pending';
  insert into private.recipient_invitations(sender_id,relationship_id,token_hash,phone,sender_name,frequency,disclosure,policy_version,setup_revision,setup_state)
  values(sid,r.id,data->>'token_hash',r.phone,data->>'sender_name',r.state->>'frequency' || ' schedule; selected days: ' || coalesce((r.state->'days')::text,'[]') || '; up to one planned text per day, subject to plan limits',data->>'disclosure',data->>'policy_version',r.revision,r.state) returning * into i;
  return jsonb_build_object('id',i.id,'expires_at',i.expires_at);
 end if;
 select * into i from private.recipient_invitations where token_hash=data->>'token_hash' for update;
 if not found then return jsonb_build_object('error','Invitation unavailable'); end if;
 if action='revoke' then
  if i.sender_id<>(data->>'sender_id')::uuid then return jsonb_build_object('error','Invitation unavailable'); end if;
 elsif i.expires_at<=now() then return jsonb_build_object('error','Invitation expired');
 end if;
 if action<>'revoke' and not exists(select 1 from public.onboarding_states os join public.relationships rel on rel.id=os.relationship_id join public.recipients rec on rec.id=rel.recipient_id where os.relationship_id=i.relationship_id and os.revision=i.setup_revision and os.state=i.setup_state and rec.phone=i.phone) then
  update private.recipient_invitations set status='revoked',challenge_hash=null where id=i.id;
  return jsonb_build_object('error','Setup changed; request a new invitation');
 end if;
 if action='view' then return jsonb_build_object('sender',i.sender_name,'frequency',i.frequency,'phone_hint','ending in '||right(i.phone,4),'disclosure',i.disclosure,'policy_version',i.policy_version,'status',i.status,'test_only',true); end if;
 if i.status<>'pending' and not(action='revoke' and i.status='accepted_test') then return jsonb_build_object('error','Invitation already completed or revoked'); end if;
 if action='challenge' then
  if data->>'phone' is distinct from i.phone then return jsonb_build_object('error','Phone does not match invitation'); end if;
  if i.sends>=3 or i.last_sent_at>now()-interval '30 seconds' then return jsonb_build_object('error','Verification request limit reached'); end if;
  update private.recipient_invitations set challenge_hash=data->>'challenge_hash',challenge_expires_at=now()+interval '5 minutes',sends=sends+1,last_sent_at=now() where id=i.id;
  return jsonb_build_object('ok',true,'test_only',true);
 elsif action='verify' then
  if data->'affirmative' is distinct from 'true'::jsonb or data->>'policy_version' is distinct from i.policy_version then return jsonb_build_object('error','Affirmative consent to current disclosure is required'); end if;
  if i.challenge_hash is null or i.challenge_expires_at<=now() or i.attempts>=5 then return jsonb_build_object('error','Verification expired or locked'); end if;
  update private.recipient_invitations set attempts=attempts+1 where id=i.id;
  if data->>'challenge_hash' is distinct from i.challenge_hash then return jsonb_build_object('error','Incorrect verification code'); end if;
  action:='accepted_test';
 elsif action not in ('decline','revoke') then return jsonb_build_object('error','Unsupported action');
 else action:=case action when 'decline' then 'declined' else 'revoked' end;
 end if;
 update private.recipient_invitations set status=action,challenge_hash=null where id=i.id;
 insert into private.recipient_consent_test_events(invitation_id,action,phone,sender_id,relationship_id,disclosure,policy_version,frequency)
 values(i.id,action,i.phone,i.sender_id,i.relationship_id,i.disclosure,i.policy_version,i.frequency);
 return jsonb_build_object('ok',true,'status',action,'test_only',true,'live_consent',false);
end $$;
revoke all on function public.recipient_invitation_test(text,jsonb) from public,anon,authenticated;
grant execute on function public.recipient_invitation_test(text,jsonb) to service_role;
commit;
