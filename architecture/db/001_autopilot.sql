-- CareText Trusted Autopilot foundation (PostgreSQL / Supabase)
-- Run after creating authenticated accounts and recipient relationship records.
create extension if not exists pgcrypto;

create table if not exists caretext_autopilot_settings (
  relationship_id uuid primary key,
  sender_id uuid not null,
  recipient_id uuid not null,
  mode text not null default 'manual' check (mode in ('manual','autopilot','paused')),
  eligible_at timestamptz not null,
  opted_in_at timestamptz,
  opted_in_policy_version text,
  recipient_disclosed_at timestamptz,
  recipient_consent_valid boolean not null default false,
  profile_revision integer not null default 1,
  approved_profile_revision integer,
  off_limits_revision integer not null default 1,
  approved_off_limits_revision integer,
  pause_reason text,
  updated_at timestamptz not null default now(),
  constraint autopilot_activation_guard check (
    mode <> 'autopilot' or (
      opted_in_at is not null and opted_in_policy_version is not null
      and recipient_disclosed_at is not null
      and recipient_consent_valid
      and approved_profile_revision = profile_revision
      and approved_off_limits_revision = off_limits_revision
    )
  )
);

create table if not exists caretext_message_queue (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references caretext_autopilot_settings(relationship_id),
  sender_id uuid not null,
  recipient_id uuid not null,
  content text not null,
  profile_revision integer not null,
  off_limits_revision integer not null,
  delivery_at timestamptz not null,
  approval_mode text not null check (approval_mode in ('human','autopilot')),
  human_approved_at timestamptz,
  state text not null default 'draft' check (state in ('draft','approved','queued','sending','sent','cancelled','failed')),
  idempotency_key uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint approval_integrity check (approval_mode <> 'human' or state in ('draft','cancelled','failed') or human_approved_at is not null)
);

create table if not exists caretext_autopilot_events (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null,
  actor_id uuid,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Deny all access until policies are explicitly configured; server-side operations
-- must validate authenticated sender ownership and never trust client sender IDs.
alter table caretext_autopilot_settings enable row level security;
alter table caretext_message_queue enable row level security;
alter table caretext_autopilot_events enable row level security;
