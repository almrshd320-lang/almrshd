-- =============================================================================
-- Behaviour & security test suite — runs against a real PostgreSQL database.
--
--   psql -d almurshid_test -v ON_ERROR_STOP=1 -f tests/sql/behaviour.sql
--
-- Every check RAISEs on failure, so a non-zero exit means a real regression.
-- =============================================================================

\set ON_ERROR_STOP on
\timing off
\set QUIET on

create or replace function pg_temp.ok(p_condition boolean, p_label text)
returns void language plpgsql as $$
begin
  if p_condition then
    raise notice '  ✓ %', p_label;
  else
    raise exception '  ✗ FAILED: %', p_label;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Fixtures: an admin, a manager and a counter-staff account.
-- -----------------------------------------------------------------------------
do $$
declare
  v_admin uuid;
  v_staff uuid;
begin
  insert into auth.users (email) values ('admin@test.local')
  on conflict (email) do update set email = excluded.email
  returning id into v_admin;

  insert into auth.users (email) values ('staff@test.local')
  on conflict (email) do update set email = excluded.email
  returning id into v_staff;

  insert into public.user_roles (user_id, role_key) values (v_admin, 'admin')
  on conflict do nothing;
  insert into public.user_roles (user_id, role_key) values (v_staff, 'staff')
  on conflict do nothing;

  -- Open the booking window for the duration of the suite.
  update public.app_settings
     set value = to_jsonb((now() - interval '1 hour')::text)
   where key = 'booking_launch_at';
end $$;

\echo ''
\echo '━━ 1. Idempotency ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
do $$
declare
  v_variant uuid;
  v_branch  uuid;
  v_a       jsonb;
  v_b       jsonb;
  v_qty_before integer;
  v_qty_after  integer;
  v_key     text := 'idem-' || gen_random_uuid()::text;
begin
  select v.id into v_variant from public.product_variants v
    join public.devices_stock s on s.variant_id = v.id
    join public.products p on p.id = v.product_id
   where p.is_bookable and s.quantity > 5 limit 1;
  select id into v_branch from public.branches where is_active limit 1;

  select quantity into v_qty_before from public.devices_stock where variant_id = v_variant;

  v_a := public.create_reservation(
    v_variant, 'عميل التكرار', '0912223344', 'طرابلس', 'PICKUP',
    public.sha256_hex('tok-' || v_key), v_branch, null, v_key);

  -- The same key again: must return the same reservation and consume no stock.
  v_b := public.create_reservation(
    v_variant, 'عميل التكرار', '0912223344', 'طرابلس', 'PICKUP',
    public.sha256_hex('tok-' || v_key), v_branch, null, v_key);

  select quantity into v_qty_after from public.devices_stock where variant_id = v_variant;

  perform pg_temp.ok((v_a->>'code') = (v_b->>'code'), 'retry returns the same reservation code');
  perform pg_temp.ok((v_b->>'idempotent_replay')::boolean, 'retry is flagged as a replay');
  perform pg_temp.ok(v_qty_after = v_qty_before - 1, 'retry consumed no additional stock');
  perform pg_temp.ok(not (v_a ? 'price') and not (v_a::text ilike '%price%'),
                     'reservation payload contains no price field');
end $$;

\echo ''
\echo '━━ 2. Price snapshot is immune to later changes ━━━━━━━━━━━'
do $$
declare
  v_variant uuid; v_branch uuid; v_res jsonb; v_id uuid;
  v_admin uuid; v_snapshot numeric; v_snapshot_after numeric; v_live numeric;
begin
  select id into v_admin from auth.users where email = 'admin@test.local';
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  select v.id into v_variant from public.product_variants v
    join public.devices_stock s on s.variant_id = v.id
    join public.products p on p.id = v.product_id
   where p.is_bookable and s.quantity > 5 limit 1;
  select id into v_branch from public.branches where is_active limit 1;

  perform public.admin_set_price(v_variant, 5499, 'baseline for test');

  v_res := public.create_reservation(
    v_variant, 'عميل السعر', '0913334455', 'بنغازي', 'PICKUP',
    public.sha256_hex('tok-price-' || gen_random_uuid()::text), v_branch);
  select id into v_id from public.reservations where code = v_res->>'code';

  select price_at_reservation into v_snapshot
    from public.reservation_pricing where reservation_id = v_id;
  perform pg_temp.ok(v_snapshot = 5499, 'snapshot captured the price at reservation time');

  -- The admin raises the price afterwards.
  perform public.admin_set_price(v_variant, 5799, 'price increase after the reservation');

  select price_at_reservation into v_snapshot_after
    from public.reservation_pricing where reservation_id = v_id;
  select price_lyd into v_live from public.variant_pricing where variant_id = v_variant;

  perform pg_temp.ok(v_snapshot_after = 5499, 'existing reservation keeps its original internal price');
  perform pg_temp.ok(v_live = 5799,          'the live price did change');
  perform pg_temp.ok(
    (select count(*) from public.price_history where variant_id = v_variant) >= 2,
    'every price change is recorded in price_history');
end $$;

\echo ''
\echo '━━ 3. reservation_pricing is immutable ━━━━━━━━━━━━━━━━━━━━'
do $$
declare v_id uuid; v_blocked boolean := false;
begin
  select reservation_id into v_id from public.reservation_pricing limit 1;
  begin
    update public.reservation_pricing set price_at_reservation = 1 where reservation_id = v_id;
  exception when others then v_blocked := true;
  end;
  perform pg_temp.ok(v_blocked, 'UPDATE on the price snapshot is refused by the database');

  v_blocked := false;
  begin
    delete from public.reservation_pricing where reservation_id = v_id;
  exception when others then v_blocked := true;
  end;
  perform pg_temp.ok(v_blocked, 'DELETE on the price snapshot is refused by the database');
end $$;

\echo ''
\echo '━━ 4. Cancellation restores stock exactly once ━━━━━━━━━━━━'
do $$
declare
  v_variant uuid; v_branch uuid; v_res jsonb; v_id uuid; v_admin uuid;
  v_q0 integer; v_q1 integer; v_q2 integer; v_q3 integer; v_released boolean;
begin
  select id into v_admin from auth.users where email = 'admin@test.local';
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  select v.id into v_variant from public.product_variants v
    join public.devices_stock s on s.variant_id = v.id
    join public.products p on p.id = v.product_id
   where p.is_bookable and s.quantity > 5 limit 1;
  select id into v_branch from public.branches where is_active limit 1;

  select quantity into v_q0 from public.devices_stock where variant_id = v_variant;

  v_res := public.create_reservation(
    v_variant, 'عميل الإلغاء', '0914445566', 'مصراتة', 'PICKUP',
    public.sha256_hex('tok-cancel-' || gen_random_uuid()::text), v_branch);
  select id into v_id from public.reservations where code = v_res->>'code';
  select quantity into v_q1 from public.devices_stock where variant_id = v_variant;
  perform pg_temp.ok(v_q1 = v_q0 - 1, 'reservation held one unit');

  perform public.admin_update_reservation_status(v_id, 'CANCELLED', 'اختبار الإلغاء');
  select quantity into v_q2 from public.devices_stock where variant_id = v_variant;
  select stock_released into v_released from public.reservations where id = v_id;
  perform pg_temp.ok(v_q2 = v_q0,   'cancellation returned the unit');
  perform pg_temp.ok(v_released,    'stock_released flag was set');

  -- Second release attempt (double click / retried job).
  perform public.release_reservation_stock(v_id, 'RESERVATION_RELEASE', 'duplicate attempt');
  select quantity into v_q3 from public.devices_stock where variant_id = v_variant;
  perform pg_temp.ok(v_q3 = v_q0, 'a second release does NOT restore stock twice');
end $$;

\echo ''
\echo '━━ 5. Expiry restores stock exactly once ━━━━━━━━━━━━━━━━━━'
do $$
declare
  v_variant uuid; v_branch uuid; v_res jsonb; v_id uuid;
  v_q0 integer; v_q1 integer; v_status public.reservation_status; v_n integer;
begin
  select v.id into v_variant from public.product_variants v
    join public.devices_stock s on s.variant_id = v.id
    join public.products p on p.id = v.product_id
   where p.is_bookable and s.quantity > 5 limit 1;
  select id into v_branch from public.branches where is_active limit 1;

  select quantity into v_q0 from public.devices_stock where variant_id = v_variant;

  v_res := public.create_reservation(
    v_variant, 'عميل الانتهاء', '0915556677', 'سبها', 'PICKUP',
    public.sha256_hex('tok-exp-' || gen_random_uuid()::text), v_branch);
  select id into v_id from public.reservations where code = v_res->>'code';

  update public.reservations set expires_at = now() - interval '1 minute' where id = v_id;

  v_n := public.expire_reservations(100);
  select status into v_status from public.reservations where id = v_id;
  select quantity into v_q1 from public.devices_stock where variant_id = v_variant;

  perform pg_temp.ok(v_status = 'EXPIRED', 'elapsed reservation became EXPIRED');
  perform pg_temp.ok(v_q1 = v_q0,          'expiry returned the unit');

  -- Running the job again must be a no-op.
  perform public.expire_reservations(100);
  select quantity into v_q1 from public.devices_stock where variant_id = v_variant;
  perform pg_temp.ok(v_q1 = v_q0, 'a second expiry run does not restore stock twice');

  perform pg_temp.ok(
    (select count(*) from public.reservation_status_history where reservation_id = v_id) = 2,
    'status history recorded RECEIVED then EXPIRED');
end $$;

\echo ''
\echo '━━ 6. Status transitions are validated ━━━━━━━━━━━━━━━━━━━━'
do $$
declare
  v_variant uuid; v_branch uuid; v_res jsonb; v_id uuid; v_admin uuid; v_rejected boolean;
begin
  select id into v_admin from auth.users where email = 'admin@test.local';
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  select v.id into v_variant from public.product_variants v
    join public.devices_stock s on s.variant_id = v.id
    join public.products p on p.id = v.product_id
   where p.is_bookable and s.quantity > 5 limit 1;
  select id into v_branch from public.branches where is_active limit 1;

  v_res := public.create_reservation(
    v_variant, 'عميل الحالة', '0916667788', 'طرابلس', 'PICKUP',
    public.sha256_hex('tok-status-' || gen_random_uuid()::text), v_branch);
  select id into v_id from public.reservations where code = v_res->>'code';

  -- RECEIVED → DELIVERED skips the whole workflow.
  v_rejected := false;
  begin perform public.admin_update_reservation_status(v_id, 'DELIVERED');
  exception when others then v_rejected := true; end;
  perform pg_temp.ok(v_rejected, 'RECEIVED → DELIVERED is refused');

  perform public.admin_update_reservation_status(v_id, 'CONFIRMED');
  perform public.admin_update_reservation_status(v_id, 'READY');

  -- OUT_FOR_DELIVERY is meaningless for a pickup reservation.
  v_rejected := false;
  begin perform public.admin_update_reservation_status(v_id, 'OUT_FOR_DELIVERY');
  exception when others then v_rejected := true; end;
  perform pg_temp.ok(v_rejected, 'OUT_FOR_DELIVERY is refused for a pickup reservation');

  perform pg_temp.ok(
    public.is_valid_status_transition('DELIVERED', 'CONFIRMED') = false,
    'DELIVERED is terminal');
end $$;

\echo ''
\echo '━━ 7. QR validation: single use, wrong token rejected ━━━━━'
do $$
declare
  v_variant uuid; v_branch uuid; v_res jsonb; v_id uuid; v_admin uuid;
  v_token text := 'raw-token-' || gen_random_uuid()::text;
  v_r1 jsonb; v_r2 jsonb; v_r3 jsonb; v_code text;
begin
  select id into v_admin from auth.users where email = 'admin@test.local';
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  select v.id into v_variant from public.product_variants v
    join public.devices_stock s on s.variant_id = v.id
    join public.products p on p.id = v.product_id
   where p.is_bookable and s.quantity > 5 limit 1;
  select id into v_branch from public.branches where is_active limit 1;

  v_res := public.create_reservation(
    v_variant, 'عميل الرمز', '0917778899', 'طرابلس', 'PICKUP',
    public.sha256_hex(v_token), v_branch);
  v_code := v_res->>'code';
  select id into v_id from public.reservations where code = v_code;

  -- A RECEIVED reservation is not yet collectable.
  v_r1 := public.admin_validate_qr(v_code, v_token, v_branch);
  perform pg_temp.ok(v_r1->>'result' = 'NOT_ELIGIBLE', 'QR on a RECEIVED reservation is NOT_ELIGIBLE');

  perform public.admin_update_reservation_status(v_id, 'CONFIRMED');

  v_r1 := public.admin_validate_qr(v_code, v_token, v_branch);
  perform pg_temp.ok(v_r1->>'result' = 'VALID', 'first scan of a confirmed reservation is VALID');

  v_r2 := public.admin_validate_qr(v_code, v_token, v_branch);
  perform pg_temp.ok(v_r2->>'result' = 'ALREADY_USED', 'second scan is ALREADY_USED');

  v_r3 := public.admin_validate_qr(v_code, 'wrong-token', v_branch);
  perform pg_temp.ok(v_r3->>'result' = 'INVALID', 'a valid code with the wrong token is INVALID');

  perform pg_temp.ok(
    (select count(*) from public.qr_scans where submitted_code = v_code) >= 3,
    'every scan attempt is recorded, including failures');
end $$;

\echo ''
\echo '━━ 8. Tracking cannot be enumerated ━━━━━━━━━━━━━━━━━━━━━━━'
do $$
declare
  v_variant uuid; v_branch uuid; v_res jsonb; v_code text; v_hit jsonb; v_miss jsonb;
begin
  select v.id into v_variant from public.product_variants v
    join public.devices_stock s on s.variant_id = v.id
    join public.products p on p.id = v.product_id
   where p.is_bookable and s.quantity > 5 limit 1;
  select id into v_branch from public.branches where is_active limit 1;

  v_res := public.create_reservation(
    v_variant, 'عميل التتبع', '0918889900', 'طرابلس', 'PICKUP',
    public.sha256_hex('tok-track-' || gen_random_uuid()::text), v_branch);
  v_code := v_res->>'code';

  v_hit  := public.track_reservation(v_code, '0918889900');
  perform pg_temp.ok(v_hit is not null,               'correct code + phone returns the reservation');
  perform pg_temp.ok(v_hit->>'code' = v_code,         'the right reservation is returned');
  perform pg_temp.ok(not (v_hit::text ilike '%price%'), 'the tracking payload contains no price');
  perform pg_temp.ok(v_hit->>'customer_name_masked' not like '%التتبع%', 'the customer name is masked');

  -- Same code, wrong phone.
  v_miss := public.track_reservation(v_code, '0911111111');
  perform pg_temp.ok(v_miss is null, 'correct code + wrong phone returns nothing');

  -- Unknown code.
  v_miss := public.track_reservation('MRSH-ZZZZZZ', '0918889900');
  perform pg_temp.ok(v_miss is null, 'unknown code returns nothing (same shape as a wrong phone)');
end $$;

\echo ''
\echo '━━ 9. The booking window is enforced server-side ━━━━━━━━━━'
do $$
declare
  v_variant uuid; v_branch uuid; v_blocked boolean; v_msg text;
begin
  select v.id into v_variant from public.product_variants v
    join public.devices_stock s on s.variant_id = v.id
    join public.products p on p.id = v.product_id
   where p.is_bookable and s.quantity > 5 limit 1;
  select id into v_branch from public.branches where is_active limit 1;

  -- Launch moved into the future: the countdown has not elapsed.
  update public.app_settings set value = to_jsonb((now() + interval '10 days')::text)
   where key = 'booking_launch_at';

  v_blocked := false;
  begin
    perform public.create_reservation(
      v_variant, 'عميل مبكر', '0919990011', 'طرابلس', 'PICKUP',
      public.sha256_hex('tok-early-' || gen_random_uuid()::text), v_branch);
  exception when others then v_blocked := true; v_msg := sqlerrm; end;
  perform pg_temp.ok(v_blocked and v_msg like 'BOOKING_CLOSED:NOT_YET_OPEN%',
                     'a reservation before launch is refused by the backend');

  -- Maintenance mode.
  update public.app_settings set value = to_jsonb((now() - interval '1 hour')::text)
   where key = 'booking_launch_at';
  update public.app_settings set value = 'true'::jsonb where key = 'maintenance_mode';

  v_blocked := false;
  begin
    perform public.create_reservation(
      v_variant, 'عميل الصيانة', '0919990022', 'طرابلس', 'PICKUP',
      public.sha256_hex('tok-maint-' || gen_random_uuid()::text), v_branch);
  exception when others then v_blocked := true; v_msg := sqlerrm; end;
  perform pg_temp.ok(v_blocked and v_msg like 'BOOKING_CLOSED:MAINTENANCE%',
                     'maintenance mode is enforced by the backend');

  update public.app_settings set value = 'false'::jsonb where key = 'maintenance_mode';
end $$;

\echo ''
\echo '━━ 10. Stock can never go negative ━━━━━━━━━━━━━━━━━━━━━━━━'
do $$
declare v_variant uuid; v_blocked boolean := false;
begin
  select variant_id into v_variant from public.devices_stock limit 1;
  begin
    update public.devices_stock set quantity = -1 where variant_id = v_variant;
  exception when check_violation then v_blocked := true;
  end;
  perform pg_temp.ok(v_blocked, 'a direct UPDATE to a negative quantity is refused by CHECK');

  perform pg_temp.ok(
    (select count(*) from public.devices_stock where quantity < 0) = 0,
    'no negative stock row exists anywhere');
end $$;

\echo ''
\echo '━━ 11. The audit log is append-only ━━━━━━━━━━━━━━━━━━━━━━━'
do $$
declare v_id bigint; v_blocked boolean := false;
begin
  select id into v_id from public.admin_audit_logs limit 1;
  begin update public.admin_audit_logs set action = 'tampered' where id = v_id;
  exception when others then v_blocked := true; end;
  perform pg_temp.ok(v_blocked, 'UPDATE on the audit log is refused');

  v_blocked := false;
  begin delete from public.admin_audit_logs where id = v_id;
  exception when others then v_blocked := true; end;
  perform pg_temp.ok(v_blocked, 'DELETE on the audit log is refused');

  perform pg_temp.ok(
    (select count(*) from public.admin_audit_logs where action = 'price.update') >= 2,
    'price changes reached the audit log');
end $$;

\echo ''
\echo '━━ 12. anon cannot reach anything private ━━━━━━━━━━━━━━━━━'
do $$
declare v_denied boolean;
begin
  perform pg_temp.ok(
    not has_table_privilege('anon', 'public.reservations',      'SELECT'), 'anon cannot read reservations');
  perform pg_temp.ok(
    not has_table_privilege('anon', 'public.variant_pricing',   'SELECT'), 'anon cannot read variant_pricing');
  perform pg_temp.ok(
    not has_table_privilege('anon', 'public.reservation_pricing','SELECT'), 'anon cannot read the price snapshot');
  perform pg_temp.ok(
    not has_table_privilege('anon', 'public.admin_audit_logs',  'SELECT'), 'anon cannot read audit logs');
  perform pg_temp.ok(
    not has_table_privilege('anon', 'public.devices_stock',     'SELECT'), 'anon cannot read exact stock');
  perform pg_temp.ok(
    not has_function_privilege('anon',
      'public.create_reservation(uuid,text,text,text,public.delivery_method,text,uuid,text,text,text)',
      'EXECUTE'),
    'anon cannot call create_reservation directly');
  perform pg_temp.ok(
    has_table_privilege('anon', 'public.v_public_variants', 'SELECT'),
    'anon CAN read the public availability view');
end $$;

\echo ''
\echo '━━ 13. The public view leaks neither price nor exact stock ━'
do $$
declare v_cols text;
begin
  select string_agg(column_name, ', ') into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'v_public_variants'
    and (column_name ilike '%price%' or column_name ilike '%lyd%' or column_name ilike '%cost%');
  perform pg_temp.ok(v_cols is null, 'v_public_variants has no price-shaped column');

  perform pg_temp.ok(
    (select count(*) from public.v_public_variants where exact_quantity is not null) = 0,
    'exact_quantity is withheld while show_exact_stock is off');

  perform pg_temp.ok(
    (select count(distinct availability) from public.v_public_variants) >= 2,
    'availability states are exposed instead of numbers');
end $$;

\echo ''
\echo '━━ 14. Counter staff can work without seeing prices ━━━━━━━'
do $$
declare
  v_staff uuid; v_res_id uuid; v_detail jsonb; v_forbidden boolean := false;
begin
  select id into v_staff from auth.users where email = 'staff@test.local';
  perform set_config('request.jwt.claim.sub', v_staff::text, true);

  perform pg_temp.ok(public.has_permission('view_reservations'), 'staff can view reservations');
  perform pg_temp.ok(public.has_permission('scan_qr'),           'staff can scan QR codes');
  perform pg_temp.ok(not public.has_permission('view_prices'),   'staff cannot view prices');
  perform pg_temp.ok(not public.has_permission('manage_prices'), 'staff cannot manage prices');

  select id into v_res_id from public.reservations order by created_at desc limit 1;
  v_detail := public.admin_reservation_detail(v_res_id);

  perform pg_temp.ok(v_detail->>'price_at_reservation' is null,
                     'the internal price is withheld from a staff account');
  perform pg_temp.ok((v_detail->>'can_view_price')::boolean = false,
                     'the payload reports that pricing is unavailable to this user');
  perform pg_temp.ok(v_detail->>'customer_name' is not null,
                     'staff still get the operational data they need');

  begin perform public.admin_set_price(
    (select variant_id from public.product_variants v join public.product_variants x on true limit 1), 1);
  exception when others then v_forbidden := true; end;
  perform pg_temp.ok(v_forbidden, 'staff calling admin_set_price is refused');
end $$;

\echo ''
\echo '━━ 15. Phone normalisation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
do $$
begin
  perform pg_temp.ok(public.normalize_libyan_phone('0912345678')     = '218912345678', 'local 09… form');
  perform pg_temp.ok(public.normalize_libyan_phone('+218 91 234 5678') = '218912345678', 'international with spaces');
  perform pg_temp.ok(public.normalize_libyan_phone('00218912345678')  = '218912345678', '00218 prefix');
  perform pg_temp.ok(public.normalize_libyan_phone('912345678')       = '218912345678', 'bare 9-digit form');
  perform pg_temp.ok(public.normalize_libyan_phone('٠٩١٢٣٤٥٦٧٨')     = '218912345678', 'Arabic-Indic digits');
  perform pg_temp.ok(public.normalize_libyan_phone('0812345678')      is null,          'invalid operator prefix');
  perform pg_temp.ok(public.normalize_libyan_phone('091234')          is null,          'too short');
  perform pg_temp.ok(public.normalize_libyan_phone('not a phone')     is null,          'non-numeric input');
  perform pg_temp.ok(public.mask_phone('218912345678') = '218•••••5678',                'phone masking');
end $$;

\echo ''
\echo '━━ 16. Reservation codes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
do $$
declare v_codes text[]; v_n integer;
begin
  select array_agg(public.generate_reservation_code()) into v_codes
  from generate_series(1, 2000);

  select count(distinct c) into v_n from unnest(v_codes) c;
  perform pg_temp.ok(v_n = 2000, '2000 generated codes are all distinct');

  perform pg_temp.ok(
    (select bool_and(c ~ '^MRSH-[0-9A-HJKMNP-TV-Z]{6}$') from unnest(v_codes) c),
    'every code matches the required format');

  perform pg_temp.ok(
    (select bool_and(c !~ '[ILOU]') from unnest(v_codes) c),
    'no ambiguous characters (I, L, O, U) appear');
end $$;

\echo ''
\echo '━━ 17. Rate limiting ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
do $$
declare v_id text := public.sha256_hex('test-ip-' || gen_random_uuid()::text); r record; v_allowed int := 0;
begin
  for i in 1..5 loop
    select * into r from public.check_rate_limit('test_bucket', v_id, 3, 600);
    if r.allowed then v_allowed := v_allowed + 1; end if;
  end loop;
  perform pg_temp.ok(v_allowed = 3, 'exactly 3 of 5 requests are allowed at a limit of 3');

  select * into r from public.check_rate_limit('test_bucket', v_id, 3, 600);
  perform pg_temp.ok(not r.allowed and r.remaining = 0, 'further requests are refused with 0 remaining');
end $$;

\echo ''
\echo '━━ 18. Data-shape guarantees ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
do $$
declare v_bad integer;
begin
  perform pg_temp.ok(
    (select count(*) from information_schema.columns
      where table_schema='public' and table_name='reservations'
        and column_name ilike '%price%') = 0,
    'the reservations table has no price column');

  select count(*) into v_bad from public.reservations r
   where (r.delivery_method = 'PICKUP'   and r.branch_id is null)
      or (r.delivery_method = 'DELIVERY' and r.delivery_city is null);
  perform pg_temp.ok(v_bad = 0, 'every reservation has a coherent delivery shape');

  select count(*) into v_bad from public.reservations
   where customer_phone !~ '^218(9[1-6])[0-9]{7}$';
  perform pg_temp.ok(v_bad = 0, 'every stored phone number is normalised');

  perform pg_temp.ok(
    (select count(*) from public.reservations r
      left join public.reservation_pricing rp on rp.reservation_id = r.id
      where rp.reservation_id is null) = 0,
    'every reservation has exactly one price snapshot');
end $$;

\echo ''
\echo '═══════════════════════════════════════════════════════════'
\echo '  ALL BEHAVIOUR & SECURITY CHECKS PASSED'
\echo '═══════════════════════════════════════════════════════════'
