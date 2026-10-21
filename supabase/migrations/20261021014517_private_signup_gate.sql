begin;
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
grant usage on schema private to supabase_auth_admin,service_role;
create table private.signup_allowlist(email text primary key check(email=lower(email)));
alter table private.signup_allowlist enable row level security;
revoke all on private.signup_allowlist from public,anon,authenticated;
grant select on private.signup_allowlist to supabase_auth_admin;
grant all on private.signup_allowlist to service_role;
create policy auth_read on private.signup_allowlist for select to supabase_auth_admin using(true);
create function private.before_user_created(event jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from private.signup_allowlist where email=lower(event->'user'->>'email')) then return '{}'::jsonb; end if;
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','CareText registration is currently limited to invited testers.'));
end $$;
revoke all on function private.before_user_created(jsonb) from public,anon,authenticated;
grant execute on function private.before_user_created(jsonb) to supabase_auth_admin;
commit;
