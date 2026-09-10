-- =============================================================================
-- 0013 — Admin read views
--
-- These use security_invoker = true — the OPPOSITE of the public views. They run
-- as the calling admin, so the RLS policies from 0010 apply in full: a staff
-- account querying v_admin_reservations sees rows because it has
-- view_reservations, and gets nothing from v_admin_pricing because it does not
-- have view_prices.
--
-- Filtering and sorting therefore happen in PostgREST against a view that is
-- already access-controlled, rather than in application code.
-- =============================================================================

drop view if exists public.v_admin_reservations;
create view public.v_admin_reservations
with (security_invoker = true) as
select
  r.id,
  r.code,
  r.status,
  r.customer_name,
  r.customer_phone,
  r.customer_city,
  r.delivery_method,
  r.delivery_city,
  r.branch_id,
  b.name_ar          as branch_name_ar,
  r.variant_id,
  p.id               as product_id,
  p.name_ar          as product_name_ar,
  p.slug             as product_slug,
  c.id               as capacity_id,
  c.key              as capacity_key,
  c.label_ar         as capacity_label_ar,
  col.id             as color_id,
  col.key            as color_key,
  col.name_ar        as color_name_ar,
  col.hex            as color_hex,
  r.expires_at,
  r.qr_used_at,
  r.stock_released,
  r.created_at,
  r.updated_at
from public.reservations r
join public.product_variants v on v.id = r.variant_id
join public.products   p   on p.id   = v.product_id
join public.capacities c   on c.id   = v.capacity_id
join public.colors     col on col.id = v.color_id
left join public.branches b on b.id = r.branch_id;

comment on view public.v_admin_reservations is
  'Admin reservation list. Carries NO price: the internal snapshot is fetched '
  'separately by admin_reservation_detail(), which checks view_prices.';

-- -----------------------------------------------------------------------------
-- Inventory board
-- -----------------------------------------------------------------------------
drop view if exists public.v_admin_stock;
create view public.v_admin_stock
with (security_invoker = true) as
select
  v.id            as variant_id,
  v.sku,
  v.is_active,
  p.id            as product_id,
  p.name_ar       as product_name_ar,
  p.display_order as product_order,
  c.key           as capacity_key,
  c.label_ar      as capacity_label_ar,
  c.size_gb,
  col.name_ar     as color_name_ar,
  col.key         as color_key,
  col.hex         as color_hex,
  col.display_order as color_order,
  s.quantity,
  s.reserved_quantity,
  s.low_stock_threshold,
  s.updated_at,
  case
    when s.quantity = 0                      then 'SOLD_OUT'
    when s.quantity <= s.low_stock_threshold then 'LIMITED'
    else 'IN_STOCK'
  end as availability
from public.product_variants v
join public.products   p   on p.id   = v.product_id
join public.capacities c   on c.id   = v.capacity_id
join public.colors     col on col.id = v.color_id
join public.devices_stock s on s.variant_id = v.id;

-- -----------------------------------------------------------------------------
-- Audit trail
-- -----------------------------------------------------------------------------
drop view if exists public.v_admin_audit;
create view public.v_admin_audit
with (security_invoker = true) as
select
  a.id, a.actor_email, a.actor_type, a.action, a.entity_type, a.entity_id,
  a.reservation_id, a.variant_id, a.previous_value, a.new_value, a.reason,
  a.created_at,
  r.code as reservation_code
from public.admin_audit_logs a
left join public.reservations r on r.id = a.reservation_id;

-- -----------------------------------------------------------------------------
-- Stock ledger
-- -----------------------------------------------------------------------------
drop view if exists public.v_admin_stock_history;
create view public.v_admin_stock_history
with (security_invoker = true) as
select
  h.id, h.variant_id, h.previous_quantity, h.new_quantity, h.delta, h.reason,
  h.changed_by_email, h.note, h.created_at,
  v.sku, p.name_ar as product_name_ar, c.key as capacity_key, col.name_ar as color_name_ar,
  r.code as reservation_code
from public.stock_history h
join public.product_variants v on v.id = h.variant_id
join public.products   p   on p.id   = v.product_id
join public.capacities c   on c.id   = v.capacity_id
join public.colors     col on col.id = v.color_id
left join public.reservations r on r.id = h.reservation_id;

grant select on
  public.v_admin_reservations,
  public.v_admin_stock,
  public.v_admin_audit,
  public.v_admin_stock_history
to authenticated;

-- Re-run the anon assertions: these views must NOT have become readable.
do $$
declare v_offenders text;
begin
  select string_agg(c.relname, ', ') into v_offenders
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'v'
    and c.relname like 'v_admin_%'
    and has_table_privilege('anon', c.oid, 'SELECT');

  if v_offenders is not null then
    raise exception 'SECURITY REGRESSION: anon can read admin view(s): %', v_offenders;
  end if;
end $$;
