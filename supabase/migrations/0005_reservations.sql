-- =============================================================================
-- 0005 — Reservations, price snapshot, status history, QR scans
-- =============================================================================

-- -----------------------------------------------------------------------------
-- reservations
--
-- Deliberately has NO price column. The internal snapshot lives in
-- reservation_pricing so that a customer-facing query cannot leak it even if a
-- future policy or RPC is written carelessly.
-- -----------------------------------------------------------------------------
create table if not exists public.reservations (
  id                 uuid primary key default gen_random_uuid(),

  -- Public identifier. Non-sequential, safe to read aloud on the phone.
  code               text not null unique
                       check (code ~ '^MRSH-[0-9A-HJKMNP-TV-Z]{6}$'),

  -- SHA-256 of the raw access token. The raw value exists only in the QR code
  -- and the customer's confirmation link — never in the database.
  access_token_hash  text not null check (length(access_token_hash) = 64),

  -- Guards against double-submit / retried network requests.
  idempotency_key    text unique,

  variant_id         uuid not null references public.product_variants(id) on delete restrict,

  customer_name      text not null check (length(btrim(customer_name)) between 3 and 120),
  -- Normalised to 218XXXXXXXXX by the server before it ever reaches this table.
  customer_phone     text not null check (customer_phone ~ '^218(9[1-6])[0-9]{7}$'),
  customer_city      text not null check (length(btrim(customer_city)) between 2 and 80),

  delivery_method    public.delivery_method not null,
  branch_id          uuid references public.branches(id) on delete restrict,
  delivery_city      text check (delivery_city is null or length(btrim(delivery_city)) between 2 and 80),

  status             public.reservation_status not null default 'RECEIVED',

  -- The exactly-once guard for inventory restoration. Flipped in the same
  -- locked transaction that returns the unit to stock.
  stock_released     boolean not null default false,

  expires_at         timestamptz not null,

  qr_used_at         timestamptz,
  qr_used_by         uuid references public.profiles(id) on delete set null,
  qr_used_branch_id  uuid references public.branches(id) on delete set null,

  internal_notes     text check (internal_notes is null or length(internal_notes) <= 2000),
  source             text not null default 'WEB',

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Pickup requires a branch; delivery requires a destination city.
  constraint chk_delivery_shape check (
    (delivery_method = 'PICKUP'   and branch_id is not null and delivery_city is null)
    or
    (delivery_method = 'DELIVERY' and delivery_city is not null)
  )
);

comment on table public.reservations is
  'Customer reservations. No price column by design — see reservation_pricing.';

create index if not exists idx_reservations_status     on public.reservations(status, created_at desc);
create index if not exists idx_reservations_variant    on public.reservations(variant_id, created_at desc);
create index if not exists idx_reservations_phone      on public.reservations(customer_phone);
create index if not exists idx_reservations_created    on public.reservations(created_at desc);
create index if not exists idx_reservations_branch     on public.reservations(branch_id) where branch_id is not null;
-- Drives the expiry job: only live reservations can expire.
create index if not exists idx_reservations_expiring   on public.reservations(expires_at)
  where status in ('RECEIVED', 'CONFIRMED');
-- Trigram index so admins can search names quickly, including Arabic substrings.
create index if not exists idx_reservations_name_trgm
  on public.reservations using gin (customer_name extensions.gin_trgm_ops);

drop trigger if exists set_updated_at on public.reservations;
create trigger set_updated_at before update on public.reservations
  for each row execute function public.tg_set_updated_at();

-- Now that reservations exists, close the loop on the stock ledger.
do $$ begin
  alter table public.stock_history
    add constraint fk_stock_history_reservation
    foreign key (reservation_id) references public.reservations(id) on delete restrict;
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- reservation_pricing — 🔒 PRIVATE immutable snapshot.
--
-- A later price change never touches an existing reservation: this row is
-- written once, inside the reservation transaction, and blocked from update.
-- -----------------------------------------------------------------------------
create table if not exists public.reservation_pricing (
  reservation_id      uuid primary key references public.reservations(id) on delete restrict,
  price_at_reservation numeric(12,2) not null check (price_at_reservation >= 0),
  currency            text not null default 'LYD',
  captured_at         timestamptz not null default now()
);

comment on table public.reservation_pricing is
  'PRIVATE. Immutable internal price at the moment of reservation, for accounting '
  'and future payment support. Never exposed to customers.';

drop trigger if exists block_mutation on public.reservation_pricing;
create trigger block_mutation before update or delete on public.reservation_pricing
  for each row execute function public.tg_block_mutation();

-- -----------------------------------------------------------------------------
-- reservation_status_history — append-only audit of every transition
-- -----------------------------------------------------------------------------
create table if not exists public.reservation_status_history (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  from_status    public.reservation_status,
  to_status      public.reservation_status not null,
  actor          public.actor_type not null default 'SYSTEM',
  changed_by     uuid,              -- intentionally no FK (append-only, see 0004)
  changed_by_email text,
  note           text check (note is null or length(note) <= 500),
  created_at     timestamptz not null default now()
);

create index if not exists idx_status_history_reservation
  on public.reservation_status_history(reservation_id, created_at asc);

drop trigger if exists block_mutation on public.reservation_status_history;
create trigger block_mutation before update or delete on public.reservation_status_history
  for each row execute function public.tg_block_mutation();

-- -----------------------------------------------------------------------------
-- qr_scans — every scan attempt, including failures. Makes brute force visible.
-- -----------------------------------------------------------------------------
create table if not exists public.qr_scans (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid references public.reservations(id) on delete restrict,
  submitted_code text,
  token_hash     text,
  result         public.qr_scan_result not null,
  scanned_by     uuid,              -- intentionally no FK (append-only, see 0004)
  branch_id      uuid references public.branches(id) on delete restrict,
  ip_hash        text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_qr_scans_reservation on public.qr_scans(reservation_id, created_at desc);
create index if not exists idx_qr_scans_created     on public.qr_scans(created_at desc);

drop trigger if exists block_mutation on public.qr_scans;
create trigger block_mutation before update or delete on public.qr_scans
  for each row execute function public.tg_block_mutation();

-- -----------------------------------------------------------------------------
-- Status transition matrix, enforced in the database.
-- -----------------------------------------------------------------------------
create or replace function public.is_valid_status_transition(
  p_from public.reservation_status,
  p_to   public.reservation_status,
  p_delivery_method public.delivery_method default null
)
returns boolean
language plpgsql
immutable
as $$
begin
  if p_from = p_to then
    return false;
  end if;

  -- OUT_FOR_DELIVERY is meaningless for a pickup reservation.
  if p_to = 'OUT_FOR_DELIVERY' and p_delivery_method = 'PICKUP' then
    return false;
  end if;

  return case p_from
    when 'RECEIVED'         then p_to in ('CONFIRMED', 'CANCELLED', 'EXPIRED')
    when 'CONFIRMED'        then p_to in ('READY', 'CANCELLED', 'EXPIRED')
    when 'READY'            then p_to in ('OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED')
    when 'OUT_FOR_DELIVERY' then p_to in ('DELIVERED', 'CANCELLED')
    -- DELIVERED / CANCELLED / EXPIRED are terminal.
    else false
  end;
end;
$$;

comment on function public.is_valid_status_transition is
  'Single source of truth for the reservation state machine. Called by the status RPC.';
