-- =============================================================================
-- 0008 — The reservation engine
--
-- Every function here is SECURITY DEFINER and granted ONLY to service_role
-- (see 0011_grants.sql). The anonymous browser key cannot execute any of them;
-- customers reach them exclusively through Next.js Server Actions, which
-- rate-limit, validate and hash before delegating.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The customer-safe projection of a reservation.
--
-- Columns are listed by hand. There is no `select *` and no join to
-- reservation_pricing anywhere in this function.
-- -----------------------------------------------------------------------------
create or replace function public.reservation_public_payload(p_reservation_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select jsonb_build_object(
    'code',              r.code,
    'status',            r.status,
    'delivery_method',   r.delivery_method,
    'created_at',        r.created_at,
    'expires_at',        r.expires_at,
    'product', jsonb_build_object(
      'slug',    p.slug,
      'name_ar', p.name_ar
    ),
    'capacity', jsonb_build_object(
      'key',      c.key,
      'label_ar', c.label_ar
    ),
    'color', jsonb_build_object(
      'key',     col.key,
      'name_ar', col.name_ar,
      'hex',     col.hex
    ),
    'branch', case when b.id is null then null else jsonb_build_object(
      'name_ar',    b.name_ar,
      'city_ar',    b.city_ar,
      'address_ar', b.address_ar,
      'phone',      b.phone,
      'maps_url',   b.maps_url
    ) end,
    'delivery_city', r.delivery_city,
    'customer_name_masked',
      left(btrim(r.customer_name), 1) || repeat('•', greatest(length(btrim(r.customer_name)) - 1, 1)),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
               'to_status',  h.to_status,
               'created_at', h.created_at
             ) order by h.created_at asc)
      from public.reservation_status_history h
      where h.reservation_id = r.id
    ), '[]'::jsonb)
  )
  from public.reservations r
  join public.product_variants v on v.id = r.variant_id
  join public.products   p   on p.id   = v.product_id
  join public.capacities c   on c.id   = v.capacity_id
  join public.colors     col on col.id = v.color_id
  left join public.branches b on b.id  = r.branch_id
  where r.id = p_reservation_id;
$$;

comment on function public.reservation_public_payload is
  'Customer-safe reservation projection. Contains no price, no internal id, no raw phone.';

-- =============================================================================
-- create_reservation — the atomic core of the platform
-- =============================================================================
create or replace function public.create_reservation(
  p_variant_id        uuid,
  p_customer_name     text,
  p_customer_phone    text,
  p_customer_city     text,
  p_delivery_method   public.delivery_method,
  p_access_token_hash text,
  p_branch_id         uuid default null,
  p_delivery_city     text default null,
  p_idempotency_key   text default null,
  p_source            text default 'WEB'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_existing_id   uuid;
  v_window        record;
  v_variant       record;
  v_stock         record;
  v_price         numeric(12,2);
  v_currency      text;
  v_code          text;
  v_attempts      integer := 0;
  v_reservation_id uuid;
  v_expiry_hours  integer;
  v_phone         text;
  v_name          text;
  v_city          text;
  v_delivery_city text;
begin
  -- ---------------------------------------------------------------------------
  -- 1. Idempotency. A retried submit returns the original reservation instead of
  --    consuming a second unit of stock.
  -- ---------------------------------------------------------------------------
  if p_idempotency_key is not null then
    select id into v_existing_id
    from public.reservations
    where idempotency_key = p_idempotency_key;

    if v_existing_id is not null then
      return public.reservation_public_payload(v_existing_id)
             || jsonb_build_object('idempotent_replay', true);
    end if;
  end if;

  -- ---------------------------------------------------------------------------
  -- 2. Booking window. Enforced here, independently of any client countdown.
  -- ---------------------------------------------------------------------------
  select * into v_window from public.booking_window_state();
  if not v_window.is_open then
    raise exception 'BOOKING_CLOSED:%', v_window.reason using errcode = 'P0001';
  end if;

  -- ---------------------------------------------------------------------------
  -- 3. Input normalisation and validation (never trust the caller).
  -- ---------------------------------------------------------------------------
  v_phone := public.normalize_libyan_phone(p_customer_phone);
  if v_phone is null then
    raise exception 'INVALID_PHONE' using errcode = 'P0001';
  end if;

  v_name := btrim(coalesce(p_customer_name, ''));
  if length(v_name) < 3 or length(v_name) > 120 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;

  v_city := btrim(coalesce(p_customer_city, ''));
  if length(v_city) < 2 or length(v_city) > 80 then
    raise exception 'INVALID_CITY' using errcode = 'P0001';
  end if;

  if p_access_token_hash is null or length(p_access_token_hash) <> 64 then
    raise exception 'INVALID_TOKEN' using errcode = 'P0001';
  end if;

  -- ---------------------------------------------------------------------------
  -- 4. Delivery method gating.
  -- ---------------------------------------------------------------------------
  if p_delivery_method = 'PICKUP' then
    if not public.get_setting_bool('pickup_enabled', true) then
      raise exception 'PICKUP_DISABLED' using errcode = 'P0001';
    end if;
    if p_branch_id is null then
      raise exception 'BRANCH_REQUIRED' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.branches where id = p_branch_id and is_active) then
      raise exception 'INVALID_BRANCH' using errcode = 'P0001';
    end if;
    v_delivery_city := null;
  else
    if not public.get_setting_bool('delivery_enabled', true) then
      raise exception 'DELIVERY_DISABLED' using errcode = 'P0001';
    end if;
    v_delivery_city := btrim(coalesce(p_delivery_city, ''));
    if length(v_delivery_city) < 2 or length(v_delivery_city) > 80 then
      raise exception 'INVALID_DELIVERY_CITY' using errcode = 'P0001';
    end if;
  end if;

  -- ---------------------------------------------------------------------------
  -- 5. Variant validity.
  -- ---------------------------------------------------------------------------
  select v.id, v.is_active, p.is_active as product_active, p.is_bookable,
         col.is_active as color_active, c.is_active as capacity_active
    into v_variant
  from public.product_variants v
  join public.products   p   on p.id   = v.product_id
  join public.colors     col on col.id = v.color_id
  join public.capacities c   on c.id   = v.capacity_id
  where v.id = p_variant_id;

  if not found
     or not v_variant.is_active
     or not v_variant.product_active
     or not v_variant.is_bookable
     or not v_variant.color_active
     or not v_variant.capacity_active then
    raise exception 'INVALID_VARIANT' using errcode = 'P0001';
  end if;

  -- ---------------------------------------------------------------------------
  -- 6. 🔒 THE LOCK.
  --
  --    Every concurrent reservation for this variant serialises on this row.
  --    Session B waits here until session A commits or rolls back, then re-reads
  --    the *current* quantity — not a stale one.
  -- ---------------------------------------------------------------------------
  select variant_id, quantity, reserved_quantity
    into v_stock
  from public.devices_stock
  where variant_id = p_variant_id
  for update;

  if not found then
    raise exception 'INVALID_VARIANT' using errcode = 'P0001';
  end if;

  if v_stock.quantity < 1 then
    raise exception 'OUT_OF_STOCK' using errcode = 'P0001';
  end if;

  -- ---------------------------------------------------------------------------
  -- 7. Deduct. The CHECK (quantity >= 0) constraint is the backstop.
  -- ---------------------------------------------------------------------------
  update public.devices_stock
     set quantity          = quantity - 1,
         reserved_quantity = reserved_quantity + 1,
         updated_at        = now()
   where variant_id = p_variant_id;

  -- ---------------------------------------------------------------------------
  -- 8. Price snapshot, taken inside the transaction. An admin price change that
  --    commits a millisecond later cannot affect this reservation.
  -- ---------------------------------------------------------------------------
  select price_lyd, currency into v_price, v_currency
  from public.variant_pricing
  where variant_id = p_variant_id
  for share;

  if v_price is null then
    -- Refuse rather than record a reservation at an implicit zero.
    raise exception 'PRICE_NOT_SET' using errcode = 'P0001';
  end if;

  -- ---------------------------------------------------------------------------
  -- 9. Reservation code. Bounded retry on the (astronomically unlikely) clash.
  -- ---------------------------------------------------------------------------
  loop
    v_attempts := v_attempts + 1;
    v_code := public.generate_reservation_code();
    exit when not exists (select 1 from public.reservations where code = v_code);
    if v_attempts >= 12 then
      raise exception 'CODE_GENERATION_FAILED' using errcode = 'P0001';
    end if;
  end loop;

  v_expiry_hours := public.get_setting_int('reservation_expiry_hours', 48);

  -- ---------------------------------------------------------------------------
  -- 10. Create the reservation.
  -- ---------------------------------------------------------------------------
  insert into public.reservations (
    code, access_token_hash, idempotency_key, variant_id,
    customer_name, customer_phone, customer_city,
    delivery_method, branch_id, delivery_city,
    status, expires_at, source
  ) values (
    v_code, p_access_token_hash, p_idempotency_key, p_variant_id,
    v_name, v_phone, v_city,
    p_delivery_method,
    case when p_delivery_method = 'PICKUP' then p_branch_id else null end,
    v_delivery_city,
    'RECEIVED',
    now() + make_interval(hours => v_expiry_hours),
    coalesce(p_source, 'WEB')
  )
  returning id into v_reservation_id;

  -- ---------------------------------------------------------------------------
  -- 11. The private price snapshot — a separate table, immutable from here on.
  -- ---------------------------------------------------------------------------
  insert into public.reservation_pricing (reservation_id, price_at_reservation, currency)
  values (v_reservation_id, v_price, coalesce(v_currency, 'LYD'));

  -- ---------------------------------------------------------------------------
  -- 12-15. History, ledger, audit, notification outbox.
  -- ---------------------------------------------------------------------------
  insert into public.reservation_status_history (reservation_id, from_status, to_status, actor)
  values (v_reservation_id, null, 'RECEIVED', 'SYSTEM');

  insert into public.stock_history (
    variant_id, previous_quantity, new_quantity, delta, reason, reservation_id, note
  ) values (
    p_variant_id, v_stock.quantity, v_stock.quantity - 1, -1,
    'RESERVATION_HOLD', v_reservation_id, 'Automatic hold on reservation ' || v_code
  );

  perform public.write_audit(
    p_action         => 'reservation.create',
    p_entity_type    => 'reservation',
    p_entity_id      => v_code,
    p_new_value      => jsonb_build_object('status', 'RECEIVED', 'variant_id', p_variant_id),
    p_actor_type     => 'CUSTOMER',
    p_reservation_id => v_reservation_id,
    p_variant_id     => p_variant_id
  );

  insert into public.notification_logs (reservation_id, event, channel, recipient_masked, status, payload)
  values (
    v_reservation_id, 'RESERVATION_CREATED', 'NONE',
    public.mask_phone(v_phone), 'QUEUED',
    jsonb_build_object('code', v_code)
  );

  -- ---------------------------------------------------------------------------
  -- 16. Return. No price. No internal id.
  -- ---------------------------------------------------------------------------
  return public.reservation_public_payload(v_reservation_id)
         || jsonb_build_object('idempotent_replay', false);
end;
$$;

comment on function public.create_reservation is
  'Atomic reservation. Locks the stock row, verifies the booking window, snapshots '
  'the internal price and writes all history in one transaction. Rolls back entirely '
  'on any failure. Granted to service_role only.';

-- =============================================================================
-- track_reservation — code + phone, no enumeration
-- =============================================================================
create or replace function public.track_reservation(
  p_code  text,
  p_phone text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_phone text := public.normalize_libyan_phone(p_phone);
  v_id    uuid;
begin
  if v_phone is null or p_code is null then
    return null;
  end if;

  -- Both conditions in one predicate: an existing code with the wrong phone and
  -- a non-existent code are indistinguishable to the caller.
  select id into v_id
  from public.reservations
  where code = upper(btrim(p_code))
    and customer_phone = v_phone;

  if v_id is null then
    return null;
  end if;

  return public.reservation_public_payload(v_id);
end;
$$;

-- =============================================================================
-- get_reservation_by_token — the confirmation page / bookmarkable link
-- =============================================================================
create or replace function public.get_reservation_by_token(
  p_code       text,
  p_token_hash text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_id uuid;
begin
  if p_code is null or p_token_hash is null or length(p_token_hash) <> 64 then
    return null;
  end if;

  select id into v_id
  from public.reservations
  where code = upper(btrim(p_code))
    and access_token_hash = p_token_hash;

  if v_id is null then
    return null;
  end if;

  return public.reservation_public_payload(v_id);
end;
$$;

-- =============================================================================
-- release_reservation_stock — the exactly-once primitive
--
-- Shared by cancellation and expiry. Assumes the caller already holds a
-- FOR UPDATE lock on the reservation row.
-- =============================================================================
create or replace function public.release_reservation_stock(
  p_reservation_id uuid,
  p_reason         public.stock_change_reason,
  p_note           text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_res   record;
  v_stock record;
begin
  select id, variant_id, stock_released, code
    into v_res
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    return false;
  end if;

  -- The guard. A second call — from a retried cron run, a double-clicked cancel
  -- button, or a cancel racing an expiry — returns without touching stock.
  if v_res.stock_released then
    return false;
  end if;

  select variant_id, quantity, reserved_quantity
    into v_stock
  from public.devices_stock
  where variant_id = v_res.variant_id
  for update;

  update public.devices_stock
     set quantity          = quantity + 1,
         reserved_quantity = greatest(reserved_quantity - 1, 0),
         updated_at        = now()
   where variant_id = v_res.variant_id;

  update public.reservations
     set stock_released = true
   where id = p_reservation_id;

  insert into public.stock_history (
    variant_id, previous_quantity, new_quantity, delta, reason, reservation_id, note
  ) values (
    v_res.variant_id, v_stock.quantity, v_stock.quantity + 1, 1,
    p_reason, p_reservation_id,
    coalesce(p_note, 'Stock restored for reservation ' || v_res.code)
  );

  return true;
end;
$$;

comment on function public.release_reservation_stock is
  'Restores one unit of stock at most once per reservation, guarded by '
  'reservations.stock_released under a row lock.';

-- =============================================================================
-- expire_reservations — idempotent, batched, safe to run every minute
-- =============================================================================
create or replace function public.expire_reservations(p_batch_limit integer default 200)
returns integer
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_row     record;
  v_expired integer := 0;
begin
  for v_row in
    select id, code, status
    from public.reservations
    where status in ('RECEIVED', 'CONFIRMED')
      and expires_at <= now()
    order by expires_at asc
    limit greatest(p_batch_limit, 1)
    -- Another concurrent run simply skips rows this one has taken.
    for update skip locked
  loop
    perform public.release_reservation_stock(
      v_row.id, 'RESERVATION_RELEASE', 'Automatic expiry of ' || v_row.code
    );

    update public.reservations set status = 'EXPIRED' where id = v_row.id;

    insert into public.reservation_status_history (reservation_id, from_status, to_status, actor, note)
    values (v_row.id, v_row.status, 'EXPIRED', 'SYSTEM', 'Reservation window elapsed');

    perform public.write_audit(
      p_action         => 'reservation.expire',
      p_entity_type    => 'reservation',
      p_entity_id      => v_row.code,
      p_previous_value => jsonb_build_object('status', v_row.status),
      p_new_value      => jsonb_build_object('status', 'EXPIRED'),
      p_actor_type     => 'SYSTEM',
      p_reservation_id => v_row.id
    );

    insert into public.notification_logs (reservation_id, event, channel, status, payload)
    values (v_row.id, 'RESERVATION_EXPIRED', 'NONE', 'QUEUED', jsonb_build_object('code', v_row.code));

    v_expired := v_expired + 1;
  end loop;

  return v_expired;
end;
$$;
