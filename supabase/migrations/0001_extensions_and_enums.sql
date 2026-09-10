-- =============================================================================
-- 0001 — Extensions, enums, shared trigger helpers
-- Al-Murshid / المرشد
-- =============================================================================

create schema if not exists extensions;

-- gen_random_bytes / digest / crypt live here. gen_random_uuid() is core in PG13+.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Enumerated domains. Using real enums (not text + CHECK) so an invalid status
-- cannot be inserted by any client, RPC or migration.
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.reservation_status as enum (
    'RECEIVED',
    'CONFIRMED',
    'READY',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'EXPIRED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.delivery_method as enum ('PICKUP', 'DELIVERY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.stock_change_reason as enum (
    'INITIAL_SEED',
    'MANUAL_SET',
    'MANUAL_ADJUST',
    'RESERVATION_HOLD',
    'RESERVATION_RELEASE',
    'RESERVATION_FULFILLED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.actor_type as enum ('SYSTEM', 'ADMIN', 'CUSTOMER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.qr_scan_result as enum ('VALID', 'ALREADY_USED', 'INVALID', 'NOT_ELIGIBLE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_channel as enum ('SMS', 'WHATSAPP', 'EMAIL', 'NONE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_status as enum ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Shared triggers
-- -----------------------------------------------------------------------------

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.tg_set_updated_at is
  'Maintains updated_at on any table that has the column.';

-- Append-only guard. Attached to audit / history tables so that not even a
-- privileged role can rewrite history without dropping the trigger first
-- (which is itself an auditable schema change).
create or replace function public.tg_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Table %.% is append-only; % is not permitted',
    tg_table_schema, tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

comment on function public.tg_block_mutation is
  'Raises on UPDATE/DELETE. Enforces append-only semantics at the storage layer.';
