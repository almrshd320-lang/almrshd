-- =============================================================================
-- LOCAL TEST SHIM — recreates the parts of Supabase the migrations depend on
-- so the exact same migration files can run against a plain PostgreSQL 16.
--
-- This file is NEVER applied to Supabase (which already provides all of it).
-- It exists so the schema, the RLS policies and the reservation engine can be
-- tested for real in CI without a Supabase instance.
-- =============================================================================

create schema if not exists auth;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- Mirrors Supabase's auth.uid(): reads the sub claim from the request GUC.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), ''))::jsonb ->> 'sub'
    ), ''
  )::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

do $$ begin
  create role anon nologin noinherit;
exception when duplicate_object then null; end $$;

do $$ begin
  create role authenticated nologin noinherit;
exception when duplicate_object then null; end $$;

-- Supabase's service_role bypasses RLS. Reproduce that here or the tests would
-- pass for the wrong reason.
do $$ begin
  create role service_role nologin noinherit bypassrls;
exception when duplicate_object then null; end $$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to service_role;
