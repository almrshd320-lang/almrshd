-- =============================================================================
-- 0003 — Catalog: branches, products, capacities, colors, variants, specs
--
-- Nothing about the product line is hard-coded in React. Adding "iPhone 19 Pro"
-- is an INSERT, not a deploy.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- branches — multiple Al-Murshid locations from day one
-- -----------------------------------------------------------------------------
create table if not exists public.branches (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9-]{2,48}$'),
  name_ar        text not null,
  name_en        text,
  city_ar        text not null,
  address_ar     text,
  phone          text,
  maps_url       text,
  opening_hours  jsonb not null default '{}'::jsonb,
  is_active      boolean not null default true,
  display_order  smallint not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_branches_active on public.branches(is_active, display_order);

drop trigger if exists set_updated_at on public.branches;
create trigger set_updated_at before update on public.branches
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- products — a model line (iPhone 18 Pro, iPhone 18 Pro Max, …)
-- -----------------------------------------------------------------------------
create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  name_ar        text not null,
  name_en        text not null,
  tagline_ar     text,
  description_ar text,
  generation     smallint,
  is_active      boolean not null default true,
  -- is_bookable separates "we show it" (comparison sections) from
  -- "you can reserve it" (only the current generation).
  is_bookable    boolean not null default false,
  is_placeholder boolean not null default true,
  hero_image_path text,
  model_3d_path   text,
  display_order  smallint not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on column public.products.is_placeholder is
  'TRUE while the product is unannounced. The UI must not present its data as confirmed.';

create index if not exists idx_products_bookable on public.products(is_active, is_bookable, display_order);

drop trigger if exists set_updated_at on public.products;
create trigger set_updated_at before update on public.products
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- capacities / colors — shared dimensions, referenced by variants
-- -----------------------------------------------------------------------------
create table if not exists public.capacities (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique check (key ~ '^[0-9]{1,4}(GB|TB)$'),
  label_ar      text not null,
  label_en      text not null,
  size_gb       integer not null check (size_gb > 0),
  display_order smallint not null default 0,
  is_active     boolean not null default true
);

create table if not exists public.colors (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique check (key ~ '^[a-z0-9-]{2,32}$'),
  name_ar       text not null,
  name_en       text not null,
  hex           text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  -- Drives the cinematic background/lighting swap on the landing page.
  gradient_from text check (gradient_from ~ '^#[0-9A-Fa-f]{6}$'),
  gradient_to   text check (gradient_to ~ '^#[0-9A-Fa-f]{6}$'),
  image_path    text,
  display_order smallint not null default 0,
  is_active     boolean not null default true
);

-- -----------------------------------------------------------------------------
-- product_variants — the reservable unit: model + capacity + color
-- -----------------------------------------------------------------------------
create table if not exists public.product_variants (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete restrict,
  capacity_id   uuid not null references public.capacities(id) on delete restrict,
  color_id      uuid not null references public.colors(id) on delete restrict,
  sku           text not null unique check (sku ~ '^[A-Z0-9-]{4,48}$'),
  is_active     boolean not null default true,
  display_order smallint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint uq_variant_combination unique (product_id, capacity_id, color_id)
);

comment on table public.product_variants is
  'NOTE: deliberately has no price column. Prices live in variant_pricing so that '
  'a SELECT * on this table can never leak pricing.';

create index if not exists idx_variants_product on public.product_variants(product_id, is_active);
create index if not exists idx_variants_lookup on public.product_variants(product_id, capacity_id, color_id);

drop trigger if exists set_updated_at on public.product_variants;
create trigger set_updated_at before update on public.product_variants
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- product_specs — configurable specification rows.
--
-- is_confirmed = false means "not officially announced". The UI renders those as
-- "يُعلن لاحقًا" rather than presenting speculation as fact.
-- -----------------------------------------------------------------------------
create table if not exists public.product_specs (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  group_key     text not null default 'general',
  key           text not null,
  label_ar      text not null,
  value_ar      text,
  value_numeric numeric(12,3),
  unit_ar       text,
  icon          text,
  is_confirmed  boolean not null default false,
  is_highlight  boolean not null default false,
  display_order smallint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint uq_product_spec unique (product_id, key)
);

comment on column public.product_specs.is_confirmed is
  'FALSE = unverified/unannounced. The UI must never render it as an official spec.';

create index if not exists idx_specs_product on public.product_specs(product_id, display_order);

drop trigger if exists set_updated_at on public.product_specs;
create trigger set_updated_at before update on public.product_specs
  for each row execute function public.tg_set_updated_at();
