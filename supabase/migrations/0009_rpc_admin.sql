-- =============================================================================
-- 0009 — Administrative RPCs
--
-- These are SECURITY DEFINER (so they can write history and audit rows) but are
-- granted to `authenticated`, NOT service_role. That is deliberate: auth.uid()
-- must resolve to the real admin so every permission check and every audit row
-- names a person. A service-role caller has no uid and is refused.
-- =============================================================================

create or replace function public.require_permission(p_permission_key text)
returns void
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if not public.has_permission(p_permission_key) then
    raise exception 'FORBIDDEN:%', p_permission_key using errcode = 'P0001';
  end if;
end;
$$;

-- =============================================================================
-- Pricing
-- =============================================================================
create or replace function public.admin_set_price(
  p_variant_id uuid,
  p_new_price  numeric,
  p_reason     text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_previous numeric(12,2);
  v_email    text;
begin
  perform public.require_permission('manage_prices');

  if p_new_price is null or p_new_price < 0 or p_new_price >= 1000000 then
    raise exception 'INVALID_PRICE' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.product_variants where id = p_variant_id) then
    raise exception 'INVALID_VARIANT' using errcode = 'P0001';
  end if;

  select email into v_email from public.profiles where id = auth.uid();

  select price_lyd into v_previous
  from public.variant_pricing where variant_id = p_variant_id for update;

  insert into public.variant_pricing (variant_id, price_lyd, updated_by)
  values (p_variant_id, round(p_new_price, 2), auth.uid())
  on conflict (variant_id) do update
    set price_lyd  = excluded.price_lyd,
        updated_by = excluded.updated_by,
        updated_at = now();

  -- Append-only. Never rewritten, never deleted.
  insert into public.price_history (
    variant_id, previous_price, new_price, changed_by, changed_by_email, reason
  ) values (
    p_variant_id, v_previous, round(p_new_price, 2), auth.uid(), v_email, p_reason
  );

  perform public.write_audit(
    p_action         => 'price.update',
    p_entity_type    => 'variant_pricing',
    p_entity_id      => p_variant_id::text,
    p_previous_value => jsonb_build_object('price_lyd', v_previous),
    p_new_value      => jsonb_build_object('price_lyd', round(p_new_price, 2)),
    p_reason         => p_reason,
    p_variant_id     => p_variant_id
  );

  return jsonb_build_object(
    'variant_id',     p_variant_id,
    'previous_price', v_previous,
    'new_price',      round(p_new_price, 2)
  );
end;
$$;

-- =============================================================================
-- Inventory
-- =============================================================================
create or replace function public.admin_set_stock(
  p_variant_id   uuid,
  p_new_quantity integer,
  p_reason       text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_previous integer;
  v_email    text;
begin
  perform public.require_permission('manage_stock');

  if p_new_quantity is null or p_new_quantity < 0 or p_new_quantity > 1000000 then
    raise exception 'INVALID_QUANTITY' using errcode = 'P0001';
  end if;

  select quantity into v_previous
  from public.devices_stock where variant_id = p_variant_id for update;

  if v_previous is null then
    raise exception 'INVALID_VARIANT' using errcode = 'P0001';
  end if;

  update public.devices_stock
     set quantity = p_new_quantity, updated_by = auth.uid(), updated_at = now()
   where variant_id = p_variant_id;

  select email into v_email from public.profiles where id = auth.uid();

  insert into public.stock_history (
    variant_id, previous_quantity, new_quantity, delta, reason,
    changed_by, changed_by_email, note
  ) values (
    p_variant_id, v_previous, p_new_quantity, p_new_quantity - v_previous,
    'MANUAL_SET', auth.uid(), v_email, p_reason
  );

  perform public.write_audit(
    p_action         => 'stock.set',
    p_entity_type    => 'devices_stock',
    p_entity_id      => p_variant_id::text,
    p_previous_value => jsonb_build_object('quantity', v_previous),
    p_new_value      => jsonb_build_object('quantity', p_new_quantity),
    p_reason         => p_reason,
    p_variant_id     => p_variant_id
  );

  return jsonb_build_object(
    'variant_id', p_variant_id, 'previous_quantity', v_previous, 'new_quantity', p_new_quantity
  );
end;
$$;

create or replace function public.admin_adjust_stock(
  p_variant_id uuid,
  p_delta      integer,
  p_reason     text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_previous integer;
  v_new      integer;
  v_email    text;
begin
  perform public.require_permission('manage_stock');

  if p_delta is null or p_delta = 0 or abs(p_delta) > 100000 then
    raise exception 'INVALID_DELTA' using errcode = 'P0001';
  end if;

  select quantity into v_previous
  from public.devices_stock where variant_id = p_variant_id for update;

  if v_previous is null then
    raise exception 'INVALID_VARIANT' using errcode = 'P0001';
  end if;

  v_new := v_previous + p_delta;
  if v_new < 0 then
    raise exception 'WOULD_GO_NEGATIVE' using errcode = 'P0001';
  end if;

  update public.devices_stock
     set quantity = v_new, updated_by = auth.uid(), updated_at = now()
   where variant_id = p_variant_id;

  select email into v_email from public.profiles where id = auth.uid();

  insert into public.stock_history (
    variant_id, previous_quantity, new_quantity, delta, reason,
    changed_by, changed_by_email, note
  ) values (
    p_variant_id, v_previous, v_new, p_delta, 'MANUAL_ADJUST', auth.uid(), v_email, p_reason
  );

  perform public.write_audit(
    p_action         => 'stock.adjust',
    p_entity_type    => 'devices_stock',
    p_entity_id      => p_variant_id::text,
    p_previous_value => jsonb_build_object('quantity', v_previous),
    p_new_value      => jsonb_build_object('quantity', v_new),
    p_reason         => p_reason,
    p_variant_id     => p_variant_id
  );

  return jsonb_build_object(
    'variant_id', p_variant_id, 'previous_quantity', v_previous, 'new_quantity', v_new
  );
end;
$$;

-- =============================================================================
-- Reservation status
-- =============================================================================
create or replace function public.admin_update_reservation_status(
  p_reservation_id uuid,
  p_new_status     public.reservation_status,
  p_note           text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_res   record;
  v_email text;
begin
  perform public.require_permission('manage_reservations');

  select id, code, status, delivery_method, variant_id, stock_released
    into v_res
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'RESERVATION_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not public.is_valid_status_transition(v_res.status, p_new_status, v_res.delivery_method) then
    raise exception 'INVALID_TRANSITION:%->%', v_res.status, p_new_status using errcode = 'P0001';
  end if;

  -- Cancelling returns the unit to stock — exactly once.
  if p_new_status = 'CANCELLED' then
    perform public.release_reservation_stock(
      p_reservation_id, 'RESERVATION_RELEASE',
      coalesce(p_note, 'Cancelled by staff: ' || v_res.code)
    );
  end if;

  -- Delivery consumes the held unit: it leaves reserved_quantity but does not
  -- return to available quantity.
  if p_new_status = 'DELIVERED' then
    update public.devices_stock
       set reserved_quantity = greatest(reserved_quantity - 1, 0), updated_at = now()
     where variant_id = v_res.variant_id;

    insert into public.stock_history (
      variant_id, previous_quantity, new_quantity, delta, reason, reservation_id, changed_by, note
    )
    select v_res.variant_id, s.quantity, s.quantity, 0, 'RESERVATION_FULFILLED',
           p_reservation_id, auth.uid(), 'Handed over: ' || v_res.code
    from public.devices_stock s where s.variant_id = v_res.variant_id;
  end if;

  update public.reservations set status = p_new_status where id = p_reservation_id;

  select email into v_email from public.profiles where id = auth.uid();

  insert into public.reservation_status_history (
    reservation_id, from_status, to_status, actor, changed_by, changed_by_email, note
  ) values (
    p_reservation_id, v_res.status, p_new_status, 'ADMIN', auth.uid(), v_email, p_note
  );

  perform public.write_audit(
    p_action         => 'reservation.status',
    p_entity_type    => 'reservation',
    p_entity_id      => v_res.code,
    p_previous_value => jsonb_build_object('status', v_res.status),
    p_new_value      => jsonb_build_object('status', p_new_status),
    p_reason         => p_note,
    p_reservation_id => p_reservation_id,
    p_variant_id     => v_res.variant_id
  );

  insert into public.notification_logs (reservation_id, event, channel, status, payload)
  values (
    p_reservation_id, 'STATUS_' || p_new_status::text, 'NONE', 'QUEUED',
    jsonb_build_object('code', v_res.code, 'status', p_new_status)
  );

  return jsonb_build_object(
    'code', v_res.code, 'previous_status', v_res.status, 'new_status', p_new_status
  );
end;
$$;

-- =============================================================================
-- QR validation — server-side only, single use, every attempt recorded
-- =============================================================================
create or replace function public.admin_validate_qr(
  p_code      text,
  p_token     text,
  p_branch_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash   text;
  v_res    record;
  v_result public.qr_scan_result;
begin
  perform public.require_permission('scan_qr');

  v_hash := public.sha256_hex(coalesce(p_token, ''));

  -- Code and token are matched in one predicate so a valid code with a bad
  -- token is indistinguishable from an unknown code.
  select id, code, status, delivery_method, qr_used_at, branch_id, variant_id
    into v_res
  from public.reservations
  where code = upper(btrim(coalesce(p_code, '')))
    and access_token_hash = v_hash
  for update;

  if not found then
    v_result := 'INVALID';
    insert into public.qr_scans (submitted_code, token_hash, result, scanned_by, branch_id)
    values (left(coalesce(p_code, ''), 32), v_hash, v_result, auth.uid(), p_branch_id);
    return jsonb_build_object('result', v_result);
  end if;

  if v_res.qr_used_at is not null then
    v_result := 'ALREADY_USED';
  elsif v_res.status not in ('CONFIRMED', 'READY', 'OUT_FOR_DELIVERY') then
    v_result := 'NOT_ELIGIBLE';
  else
    v_result := 'VALID';
  end if;

  if v_result = 'VALID' then
    update public.reservations
       set qr_used_at        = now(),
           qr_used_by        = auth.uid(),
           qr_used_branch_id = coalesce(p_branch_id, v_res.branch_id)
     where id = v_res.id;
  end if;

  insert into public.qr_scans (
    reservation_id, submitted_code, token_hash, result, scanned_by, branch_id
  ) values (
    v_res.id, v_res.code, v_hash, v_result, auth.uid(), coalesce(p_branch_id, v_res.branch_id)
  );

  perform public.write_audit(
    p_action         => 'qr.scan',
    p_entity_type    => 'reservation',
    p_entity_id      => v_res.code,
    p_new_value      => jsonb_build_object('result', v_result),
    p_reservation_id => v_res.id
  );

  return jsonb_build_object(
    'result',          v_result,
    'code',            v_res.code,
    'status',          v_res.status,
    'delivery_method', v_res.delivery_method,
    'used_at',         v_res.qr_used_at
  );
end;
$$;

-- =============================================================================
-- Dashboard metrics
-- =============================================================================
create or replace function public.admin_dashboard_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_result jsonb;
begin
  perform public.require_permission('view_reservations');

  select jsonb_build_object(
    'reservations', jsonb_build_object(
      'total',            count(*),
      'received',         count(*) filter (where status = 'RECEIVED'),
      'confirmed',        count(*) filter (where status = 'CONFIRMED'),
      'ready',            count(*) filter (where status = 'READY'),
      'out_for_delivery', count(*) filter (where status = 'OUT_FOR_DELIVERY'),
      'delivered',        count(*) filter (where status = 'DELIVERED'),
      'cancelled',        count(*) filter (where status = 'CANCELLED'),
      'expired',          count(*) filter (where status = 'EXPIRED'),
      'today',            count(*) filter (where created_at >= date_trunc('day', now())),
      'pickup',           count(*) filter (where delivery_method = 'PICKUP'),
      'delivery',         count(*) filter (where delivery_method = 'DELIVERY')
    )
  ) into v_result
  from public.reservations;

  select v_result || jsonb_build_object(
    'inventory', jsonb_build_object(
      'total_units',       coalesce(sum(s.quantity), 0),
      'reserved_units',    coalesce(sum(s.reserved_quantity), 0),
      'variants',          count(*),
      'low_stock',         count(*) filter (where s.quantity > 0 and s.quantity <= s.low_stock_threshold),
      'out_of_stock',      count(*) filter (where s.quantity = 0)
    )
  ) into v_result
  from public.devices_stock s
  join public.product_variants v on v.id = s.variant_id
  where v.is_active;

  return v_result;
end;
$$;

-- =============================================================================
-- Reservation detail for admins.
--
-- The internal price is included ONLY when the caller holds view_prices. A
-- staff user with manage_reservations but not view_prices gets everything
-- except the money.
-- =============================================================================
create or replace function public.admin_reservation_detail(p_reservation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_result   jsonb;
  v_can_price boolean;
begin
  perform public.require_permission('view_reservations');
  v_can_price := public.has_permission('view_prices');

  select jsonb_build_object(
    'id',               r.id,
    'code',             r.code,
    'status',           r.status,
    'customer_name',    r.customer_name,
    'customer_phone',   r.customer_phone,
    'customer_city',    r.customer_city,
    'delivery_method',  r.delivery_method,
    'delivery_city',    r.delivery_city,
    'branch',           case when b.id is null then null
                          else jsonb_build_object('id', b.id, 'name_ar', b.name_ar, 'city_ar', b.city_ar) end,
    'product',          jsonb_build_object('id', p.id, 'name_ar', p.name_ar, 'slug', p.slug),
    'capacity',         jsonb_build_object('key', c.key, 'label_ar', c.label_ar),
    'color',            jsonb_build_object('key', col.key, 'name_ar', col.name_ar, 'hex', col.hex),
    'variant_id',       r.variant_id,
    'expires_at',       r.expires_at,
    'qr_used_at',       r.qr_used_at,
    'stock_released',   r.stock_released,
    'internal_notes',   r.internal_notes,
    'created_at',       r.created_at,
    'updated_at',       r.updated_at,
    'price_at_reservation', case when v_can_price then rp.price_at_reservation else null end,
    'currency',             case when v_can_price then rp.currency else null end,
    'can_view_price',       v_can_price,
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'from_status', h.from_status, 'to_status', h.to_status, 'actor', h.actor,
        'changed_by_email', h.changed_by_email, 'note', h.note, 'created_at', h.created_at
      ) order by h.created_at asc)
      from public.reservation_status_history h where h.reservation_id = r.id
    ), '[]'::jsonb)
  ) into v_result
  from public.reservations r
  join public.product_variants v on v.id = r.variant_id
  join public.products   p   on p.id   = v.product_id
  join public.capacities c   on c.id   = v.capacity_id
  join public.colors     col on col.id = v.color_id
  left join public.branches b on b.id = r.branch_id
  left join public.reservation_pricing rp on rp.reservation_id = r.id
  where r.id = p_reservation_id;

  return v_result;
end;
$$;

-- =============================================================================
-- Pricing overview for the admin pricing screen
-- =============================================================================
create or replace function public.admin_pricing_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_rows jsonb;
begin
  perform public.require_permission('view_prices');

  select coalesce(jsonb_agg(row_to_json(t) order by t.product_order, t.size_gb, t.color_order), '[]'::jsonb)
    into v_rows
  from (
    select v.id                as variant_id,
           v.sku,
           p.name_ar           as product_name_ar,
           p.display_order     as product_order,
           c.key               as capacity_key,
           c.label_ar          as capacity_label_ar,
           c.size_gb,
           col.name_ar         as color_name_ar,
           col.hex             as color_hex,
           col.display_order   as color_order,
           vp.price_lyd,
           vp.currency,
           vp.updated_at       as price_updated_at,
           pr.email            as price_updated_by,
           s.quantity,
           s.reserved_quantity,
           s.low_stock_threshold
    from public.product_variants v
    join public.products   p   on p.id   = v.product_id
    join public.capacities c   on c.id   = v.capacity_id
    join public.colors     col on col.id = v.color_id
    left join public.variant_pricing vp on vp.variant_id = v.id
    left join public.profiles pr on pr.id = vp.updated_by
    left join public.devices_stock s on s.variant_id = v.id
    where v.is_active and p.is_active
  ) t;

  return v_rows;
end;
$$;

-- =============================================================================
-- Price history for one variant
-- =============================================================================
create or replace function public.admin_price_history(p_variant_id uuid, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_rows jsonb;
begin
  perform public.require_permission('view_prices');

  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb)
    into v_rows
  from (
    select h.id, h.previous_price, h.new_price, h.currency,
           h.changed_by_email, h.reason, h.created_at
    from public.price_history h
    where h.variant_id = p_variant_id
    order by h.created_at desc
    limit least(greatest(p_limit, 1), 200)
  ) t;

  return v_rows;
end;
$$;

-- =============================================================================
-- Data retention
--
-- Reservations are permanent: the stock ledger and the audit trail pin them with
-- ON DELETE RESTRICT, so there is no delete path — by design. What CAN be
-- removed is the personal data attached to a completed reservation, which is the
-- part worth minimising. The commercial record survives; the customer's name,
-- phone and city do not.
-- =============================================================================
create or replace function public.admin_anonymize_reservation(
  p_reservation_id uuid,
  p_reason         text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_res record;
begin
  perform public.require_permission('manage_reservations');

  select id, code, status, customer_name into v_res
  from public.reservations where id = p_reservation_id for update;

  if not found then
    raise exception 'RESERVATION_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Only terminal reservations. A live one still needs its contact details.
  if v_res.status not in ('DELIVERED', 'CANCELLED', 'EXPIRED') then
    raise exception 'NOT_TERMINAL' using errcode = 'P0001';
  end if;

  if v_res.customer_name = 'محذوف' then
    return jsonb_build_object('code', v_res.code, 'already_anonymized', true);
  end if;

  update public.reservations
     set customer_name  = 'محذوف',
         -- Kept schema-valid but non-identifying; the CHECK still applies.
         customer_phone = '218910000000',
         customer_city  = '—',
         delivery_city  = case when delivery_city is null then null else '—' end,
         internal_notes = null
   where id = p_reservation_id;

  perform public.write_audit(
    p_action         => 'reservation.anonymize',
    p_entity_type    => 'reservation',
    p_entity_id      => v_res.code,
    p_reason         => p_reason,
    p_reservation_id => p_reservation_id
  );

  return jsonb_build_object('code', v_res.code, 'already_anonymized', false);
end;
$$;
