-- =============================================================================
-- 0006 — Operations: settings, audit log, notifications, analytics, rate limits
-- =============================================================================

-- -----------------------------------------------------------------------------
-- app_settings — every configurable value in the product lives here.
--
-- is_public gates what the anon role can see through v_public_settings. The
-- backend NEVER reads a business rule from the client; it reads it from here.
-- -----------------------------------------------------------------------------
create table if not exists public.app_settings (
  key         text primary key check (key ~ '^[a-z0-9_.]{2,64}$'),
  value       jsonb not null,
  is_public   boolean not null default false,
  description text,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);

comment on column public.app_settings.is_public is
  'TRUE = readable by anonymous visitors through v_public_settings. Default is private.';

drop trigger if exists set_updated_at on public.app_settings;
create trigger set_updated_at before update on public.app_settings
  for each row execute function public.tg_set_updated_at();

-- Typed accessors. Every RPC reads settings through these, never inline.
create or replace function public.get_setting(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select value from public.app_settings where key = p_key;
$$;

create or replace function public.get_setting_bool(p_key text, p_default boolean default false)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce((select value #>> '{}' from public.app_settings where key = p_key)::boolean, p_default);
$$;

create or replace function public.get_setting_int(p_key text, p_default integer default 0)
returns integer
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce((select value #>> '{}' from public.app_settings where key = p_key)::integer, p_default);
$$;

create or replace function public.get_setting_ts(p_key text)
returns timestamptz
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select nullif(value #>> '{}', '')::timestamptz from public.app_settings where key = p_key;
$$;

-- -----------------------------------------------------------------------------
-- admin_audit_logs — append-only administrative trail
-- -----------------------------------------------------------------------------
-- Append-only: no cascading/nulling FKs, and no FK at all on the actor.
-- A trail that disappears when the account is deleted is worthless. See 0004.
create table if not exists public.admin_audit_logs (
  id             bigserial primary key,
  actor_id       uuid,              -- intentionally no FK
  actor_email    text,
  actor_type     public.actor_type not null default 'ADMIN',
  action         text not null check (length(action) between 3 and 64),
  entity_type    text not null check (length(entity_type) between 2 and 48),
  entity_id      text,
  reservation_id uuid references public.reservations(id) on delete restrict,
  variant_id     uuid references public.product_variants(id) on delete restrict,
  previous_value jsonb,
  new_value      jsonb,
  reason         text check (reason is null or length(reason) <= 500),
  ip_hash        text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_audit_created  on public.admin_audit_logs(created_at desc);
create index if not exists idx_audit_actor    on public.admin_audit_logs(actor_id, created_at desc);
create index if not exists idx_audit_action   on public.admin_audit_logs(action, created_at desc);
create index if not exists idx_audit_entity   on public.admin_audit_logs(entity_type, entity_id);

drop trigger if exists block_mutation on public.admin_audit_logs;
create trigger block_mutation before update or delete on public.admin_audit_logs
  for each row execute function public.tg_block_mutation();

-- Central audit writer. Every privileged RPC calls this; nothing writes the
-- table directly, so the shape stays consistent.
create or replace function public.write_audit(
  p_action         text,
  p_entity_type    text,
  p_entity_id      text default null,
  p_previous_value jsonb default null,
  p_new_value      jsonb default null,
  p_reason         text default null,
  p_actor_id       uuid default null,
  p_actor_type     public.actor_type default 'ADMIN',
  p_reservation_id uuid default null,
  p_variant_id     uuid default null,
  p_ip_hash        text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_actor uuid := coalesce(p_actor_id, auth.uid());
  v_email text;
  v_id    bigint;
begin
  if v_actor is not null then
    select email into v_email from public.profiles where id = v_actor;
  end if;

  insert into public.admin_audit_logs (
    actor_id, actor_email, actor_type, action, entity_type, entity_id,
    reservation_id, variant_id, previous_value, new_value, reason, ip_hash
  ) values (
    v_actor, v_email, p_actor_type, p_action, p_entity_type, p_entity_id,
    p_reservation_id, p_variant_id, p_previous_value, p_new_value, p_reason, p_ip_hash
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- notification_logs — provider-agnostic outbox.
--
-- The reservation engine enqueues rows; a future SMS/WhatsApp/email worker
-- drains them. No provider is baked in.
-- -----------------------------------------------------------------------------
create table if not exists public.notification_logs (
  id               uuid primary key default gen_random_uuid(),
  reservation_id   uuid references public.reservations(id) on delete cascade,
  event            text not null check (length(event) between 3 and 64),
  channel          public.notification_channel not null default 'NONE',
  recipient_masked text,
  status           public.notification_status not null default 'QUEUED',
  payload          jsonb not null default '{}'::jsonb,
  provider         text,
  provider_ref     text,
  error            text,
  attempts         smallint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.notification_logs.recipient_masked is
  'Never the full phone number — store 218•••••1234 style masks only.';

create index if not exists idx_notifications_pending
  on public.notification_logs(status, created_at) where status = 'QUEUED';
create index if not exists idx_notifications_reservation
  on public.notification_logs(reservation_id, created_at desc);

drop trigger if exists set_updated_at on public.notification_logs;
create trigger set_updated_at before update on public.notification_logs
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- analytics_events — privacy-conscious product analytics.
-- No IP, no phone, no name. session_hash is a rotating client-side random id.
-- -----------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id           bigserial primary key,
  event        text not null check (length(event) between 3 and 64),
  session_hash text check (session_hash is null or length(session_hash) <= 64),
  properties   jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists idx_analytics_event on public.analytics_events(event, created_at desc);

-- -----------------------------------------------------------------------------
-- rate_limits — Vercel functions are stateless, so the limiter lives in the DB.
-- Identifiers are always hashed; raw IPs are never stored.
-- -----------------------------------------------------------------------------
create table if not exists public.rate_limits (
  bucket          text not null,
  identifier_hash text not null,
  window_start    timestamptz not null,
  count           integer not null default 0,
  primary key (bucket, identifier_hash, window_start)
);

create index if not exists idx_rate_limits_window on public.rate_limits(window_start);

-- Fixed-window counter. Returns TRUE when the request is allowed.
create or replace function public.check_rate_limit(
  p_bucket          text,
  p_identifier_hash text,
  p_max             integer,
  p_window_seconds  integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_window_start timestamptz;
  v_count        integer;
begin
  -- Align to a fixed window so concurrent callers share the same bucket row.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits (bucket, identifier_hash, window_start, count)
  values (p_bucket, p_identifier_hash, v_window_start, 1)
  on conflict (bucket, identifier_hash, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into v_count;

  return query select
    (v_count <= p_max),
    greatest(p_max - v_count, 0),
    v_window_start + make_interval(secs => p_window_seconds);
end;
$$;

-- Housekeeping; call from the same cron that expires reservations.
create or replace function public.prune_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_deleted integer;
begin
  delete from public.rate_limits where window_start < now() - interval '24 hours';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
