-- =============================================================================
-- 0004 — Inventory and PRIVATE pricing
--
-- variant_pricing is a separate table on purpose. See docs/ARCHITECTURE.md §3.3.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- devices_stock — one row per variant. The CHECK is the last line of defence
-- against negative inventory, independent of any application logic.
-- -----------------------------------------------------------------------------
create table if not exists public.devices_stock (
  variant_id          uuid primary key references public.product_variants(id) on delete cascade,
  quantity            integer not null default 0 check (quantity >= 0),
  reserved_quantity   integer not null default 0 check (reserved_quantity >= 0),
  low_stock_threshold integer not null default 10 check (low_stock_threshold >= 0),
  updated_by          uuid references public.profiles(id) on delete set null,
  updated_at          timestamptz not null default now()
);

comment on column public.devices_stock.quantity is
  'Units available to reserve right now. Decremented inside the reservation transaction.';
comment on column public.devices_stock.reserved_quantity is
  'Units held by live reservations. Incremented on hold, decremented on release or fulfilment.';

create index if not exists idx_stock_low on public.devices_stock(quantity)
  where quantity = 0 or quantity <= 10;

drop trigger if exists set_updated_at on public.devices_stock;
create trigger set_updated_at before update on public.devices_stock
  for each row execute function public.tg_set_updated_at();

-- Every variant gets a stock row automatically, so the reservation RPC can
-- always take its FOR UPDATE lock without a NULL branch.
create or replace function public.tg_ensure_stock_row()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  insert into public.devices_stock (variant_id, quantity)
  values (new.id, 0)
  on conflict (variant_id) do nothing;
  return new;
end;
$$;

drop trigger if exists ensure_stock_row on public.product_variants;
create trigger ensure_stock_row after insert on public.product_variants
  for each row execute function public.tg_ensure_stock_row();

-- -----------------------------------------------------------------------------
-- variant_pricing — 🔒 PRIVATE. Never granted to anon. Never joined into any
-- public view. Never returned by a customer-facing RPC.
-- -----------------------------------------------------------------------------
create table if not exists public.variant_pricing (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  price_lyd  numeric(12,2) not null check (price_lyd >= 0 and price_lyd < 1000000),
  currency   text not null default 'LYD' check (currency ~ '^[A-Z]{3}$'),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.variant_pricing is
  'PRIVATE internal pricing. RLS requires view_prices. anon has NO grant on this table.';

drop trigger if exists set_updated_at on public.variant_pricing;
create trigger set_updated_at before update on public.variant_pricing
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- price_history — append-only. Records are never deleted or rewritten.
--
-- FOREIGN KEY RULE FOR APPEND-ONLY TABLES
-- ---------------------------------------
-- An append-only table can carry no FK with a cascading or nulling action: the
-- action would itself be an UPDATE/DELETE, which the block trigger refuses, and
-- the parent delete would fail with a confusing error. So:
--   • references to entities  → ON DELETE RESTRICT (history pins the entity)
--   • references to the actor → NO foreign key; the uuid and the email are
--     denormalised, so the record survives the actor's account being removed.
-- An audit trail that can be erased by deleting the person is not an audit trail.
-- -----------------------------------------------------------------------------
create table if not exists public.price_history (
  id             uuid primary key default gen_random_uuid(),
  variant_id     uuid not null references public.product_variants(id) on delete restrict,
  previous_price numeric(12,2) check (previous_price is null or previous_price >= 0),
  new_price      numeric(12,2) not null check (new_price >= 0),
  currency       text not null default 'LYD',
  changed_by     uuid,              -- intentionally no FK: see rule above
  changed_by_email text,
  reason         text check (reason is null or length(reason) <= 500),
  created_at     timestamptz not null default now()
);

create index if not exists idx_price_history_variant
  on public.price_history(variant_id, created_at desc);

drop trigger if exists block_mutation on public.price_history;
create trigger block_mutation before update or delete on public.price_history
  for each row execute function public.tg_block_mutation();

-- -----------------------------------------------------------------------------
-- stock_history — append-only ledger of every inventory movement, including
-- the automatic ones made by the reservation engine.
-- -----------------------------------------------------------------------------
create table if not exists public.stock_history (
  id                uuid primary key default gen_random_uuid(),
  variant_id        uuid not null references public.product_variants(id) on delete restrict,
  previous_quantity integer not null,
  new_quantity      integer not null,
  delta             integer not null,
  reason            public.stock_change_reason not null,
  reservation_id    uuid,              -- FK added in 0005, ON DELETE RESTRICT
  changed_by        uuid,              -- intentionally no FK: see rule above
  changed_by_email  text,
  note              text check (note is null or length(note) <= 500),
  created_at        timestamptz not null default now()
);

create index if not exists idx_stock_history_variant
  on public.stock_history(variant_id, created_at desc);
create index if not exists idx_stock_history_reservation
  on public.stock_history(reservation_id) where reservation_id is not null;

drop trigger if exists block_mutation on public.stock_history;
create trigger block_mutation before update or delete on public.stock_history
  for each row execute function public.tg_block_mutation();
