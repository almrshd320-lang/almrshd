-- =============================================================================
-- 0007 — Domain helpers and the PUBLIC read surface
--
-- These views are the ONLY thing the anonymous browser key may read. They are
-- security-definer views (they run as the owner), so the underlying tables need
-- no grant for anon at all — a defence-in-depth arrangement where forgetting an
-- RLS policy still does not expose a table.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Reservation code generation
--
-- Alphabet: 0-9 A-Z minus I, L, O, U  → 32 symbols, no character that can be
-- misheard on the phone or misread on a printed slip. 32^6 ≈ 1.07e9.
-- -----------------------------------------------------------------------------
create or replace function public.generate_reservation_code()
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_bytes    bytea := gen_random_bytes(6);
  v_code     text := '';
  i          integer;
begin
  for i in 0..5 loop
    -- 32 divides 256 evenly, so a plain modulo introduces no bias.
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return 'MRSH-' || v_code;
end;
$$;

comment on function public.generate_reservation_code is
  'Cryptographically random, non-sequential, unambiguous 6-symbol code. ~1.07e9 space.';

-- -----------------------------------------------------------------------------
-- Libyan phone normalisation. The server normalises before calling any RPC;
-- this exists so the database can normalise defensively too (tracking lookups,
-- data imports, admin edits).
--
-- Accepts:  0912345678 · 218912345678 · +218 91 234 5678 · 00218912345678
-- Produces: 218912345678   (or NULL when the input is not a valid LY mobile)
-- -----------------------------------------------------------------------------
create or replace function public.normalize_libyan_phone(p_input text)
returns text
language plpgsql
immutable
as $$
declare
  v_digits text;
begin
  if p_input is null then
    return null;
  end if;

  -- Fold Arabic-Indic digits (٠-٩) to ASCII, then strip everything else.
  v_digits := translate(p_input, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  v_digits := regexp_replace(v_digits, '[^0-9]', '', 'g');

  -- 00218… → 218…
  if v_digits like '00218%' then
    v_digits := substr(v_digits, 3);
  end if;

  -- 0912345678 (10 digits, national trunk prefix) → 218912345678
  if length(v_digits) = 10 and left(v_digits, 2) = '09' then
    v_digits := '218' || substr(v_digits, 2);
  -- 912345678 (9 digits, no trunk prefix) → 218912345678
  elsif length(v_digits) = 9 and left(v_digits, 1) = '9' then
    v_digits := '218' || v_digits;
  end if;

  if v_digits ~ '^218(9[1-6])[0-9]{7}$' then
    return v_digits;
  end if;

  return null;
end;
$$;

comment on function public.normalize_libyan_phone is
  'Normalises Libyan mobile numbers to 218XXXXXXXXX. Returns NULL when invalid.';

-- Display mask for logs and notifications: 218•••••5678
create or replace function public.mask_phone(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when p_phone is null or length(p_phone) < 8 then null
    else left(p_phone, 3) || repeat('•', length(p_phone) - 7) || right(p_phone, 4)
  end;
$$;

-- SHA-256 hex. Used for access tokens, IP hashes and rate-limit identifiers.
create or replace function public.sha256_hex(p_input text)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select encode(digest(coalesce(p_input, ''), 'sha256'), 'hex');
$$;

-- -----------------------------------------------------------------------------
-- Booking window — the single authority on "can anyone reserve right now".
-- The countdown in the browser is decoration; this is enforcement.
-- -----------------------------------------------------------------------------
create or replace function public.booking_window_state()
returns table (
  is_open        boolean,
  reason         text,
  launch_at      timestamptz,
  server_time    timestamptz
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_enabled     boolean := public.get_setting_bool('booking_enabled', false);
  v_maintenance boolean := public.get_setting_bool('maintenance_mode', false);
  v_launch      timestamptz := public.get_setting_ts('booking_launch_at');
begin
  if v_maintenance then
    return query select false, 'MAINTENANCE'::text, v_launch, now();
  elsif not v_enabled then
    return query select false, 'DISABLED'::text, v_launch, now();
  elsif v_launch is null then
    return query select false, 'NOT_CONFIGURED'::text, v_launch, now();
  elsif now() < v_launch then
    return query select false, 'NOT_YET_OPEN'::text, v_launch, now();
  else
    return query select true, 'OPEN'::text, v_launch, now();
  end if;
end;
$$;

comment on function public.booking_window_state is
  'Server-side source of truth for the booking launch. Never trust the client countdown.';

-- =============================================================================
-- PUBLIC VIEWS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- v_public_settings — only rows explicitly flagged is_public.
-- -----------------------------------------------------------------------------
drop view if exists public.v_public_settings;
create view public.v_public_settings
with (security_invoker = false) as
select key, value
from public.app_settings
where is_public = true;

-- -----------------------------------------------------------------------------
-- v_public_branches — active pickup locations. No internal columns.
-- -----------------------------------------------------------------------------
drop view if exists public.v_public_branches;
create view public.v_public_branches
with (security_invoker = false) as
select id, slug, name_ar, name_en, city_ar, address_ar, phone, maps_url,
       opening_hours, display_order
from public.branches
where is_active = true;

-- -----------------------------------------------------------------------------
-- v_public_products — catalogue metadata. No pricing anywhere in the chain.
-- -----------------------------------------------------------------------------
drop view if exists public.v_public_products;
create view public.v_public_products
with (security_invoker = false) as
select p.id, p.slug, p.name_ar, p.name_en, p.tagline_ar, p.description_ar,
       p.generation, p.is_bookable, p.is_placeholder,
       p.hero_image_path, p.model_3d_path, p.display_order
from public.products p
where p.is_active = true;

-- -----------------------------------------------------------------------------
-- v_public_specs — unconfirmed specs are surfaced WITH their flag so the UI can
-- render "يُعلن لاحقًا" instead of presenting speculation as fact.
-- -----------------------------------------------------------------------------
drop view if exists public.v_public_specs;
create view public.v_public_specs
with (security_invoker = false) as
select s.id, s.product_id, s.group_key, s.key, s.label_ar,
       case when s.is_confirmed then s.value_ar else null end as value_ar,
       case when s.is_confirmed then s.value_numeric else null end as value_numeric,
       s.unit_ar, s.icon, s.is_confirmed, s.is_highlight, s.display_order
from public.product_specs s
join public.products p on p.id = s.product_id
where p.is_active = true;

-- -----------------------------------------------------------------------------
-- v_public_variants — THE customer-facing availability surface.
--
-- Exposes availability STATE, never the number, unless app_settings.
-- show_exact_stock is explicitly turned on. Contains no price column, and by
-- construction cannot: variant_pricing is not in the FROM clause.
-- -----------------------------------------------------------------------------
drop view if exists public.v_public_variants;
create view public.v_public_variants
with (security_invoker = false) as
select
  v.id                        as variant_id,
  p.id                        as product_id,
  p.slug                      as product_slug,
  p.name_ar                   as product_name_ar,
  p.is_bookable,
  c.id                        as capacity_id,
  c.key                       as capacity_key,
  c.label_ar                  as capacity_label_ar,
  c.size_gb,
  col.id                      as color_id,
  col.key                     as color_key,
  col.name_ar                 as color_name_ar,
  col.hex                     as color_hex,
  col.gradient_from,
  col.gradient_to,
  col.image_path              as color_image_path,
  v.display_order,
  case
    when not v.is_active or not p.is_active or not col.is_active or not c.is_active
      then 'UNAVAILABLE'
    when s.quantity = 0                       then 'SOLD_OUT'
    when s.quantity <= s.low_stock_threshold  then 'LIMITED'
    else 'IN_STOCK'
  end                         as availability,
  -- NULL unless an admin has explicitly opted in to publishing exact counts.
  case
    when coalesce((select (value #>> '{}')::boolean
                   from public.app_settings where key = 'show_exact_stock'), false)
      then s.quantity
    else null
  end                         as exact_quantity
from public.product_variants v
join public.products   p   on p.id   = v.product_id
join public.capacities c   on c.id   = v.capacity_id
join public.colors     col on col.id = v.color_id
join public.devices_stock s on s.variant_id = v.id
where p.is_active = true;

comment on view public.v_public_variants is
  'Public availability. No price column exists here and none may ever be added.';
