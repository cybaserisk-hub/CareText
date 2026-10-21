-- READ ONLY catalog and aggregate checks. Contains no customer content.
begin transaction read only;
select jsonb_build_object(
 'database',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (select current_database(),version()) q),
 'tables',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (select n.nspname as schema_name,c.relname,c.relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','private') and c.relkind='r' order by 1,2) q),
 'columns',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (select table_schema,table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns where table_schema in ('public','private') order by 1,2,ordinal_position) q),
 'constraints',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (select conrelid::regclass::text as relation,conname,pg_get_constraintdef(oid) as definition
from pg_constraint where contype<>'n' and connamespace in ('public'::regnamespace,'private'::regnamespace) order by 1,2) q),
 'policies',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','private') order by 1,2,3) q),
 'table_grants',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (select grantee,table_schema,table_name,privilege_type from information_schema.table_privileges
where table_schema in ('public','private') and grantee in ('anon','authenticated','service_role') order by 1,2,3,4) q),
 'column_grants',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (select grantee,table_name,column_name,privilege_type from information_schema.column_privileges
where table_schema='public' and table_name='relationships' and grantee in ('anon','authenticated') order by 1,2,3,4) q),
 'functions',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef,p.proconfig,p.proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') order by 1,2,3) q),
 'triggers',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (select tgrelid::regclass::text as relation,tgname,pg_get_triggerdef(oid) as definition
from pg_trigger where not tgisinternal and tgrelid in(select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')) order by 1,2) q),
 'active_relationships',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (select count(*) as active_relationships_must_be_zero from public.relationships where caretouch_active) q),
 'plans',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (select plan,active_recipient_limit,monthly_sms,daily_caretouch from public.plan_allowances order by plan) q),
 'pending_objects',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (select to_regclass('private.consent_invitations') as must_be_null,
 to_regprocedure('public.production_consent(text,jsonb)') as must_also_be_null) q)
) as preflight;
commit;
