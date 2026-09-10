-- =============================================================================
-- 0010 — Row Level Security
--
-- Posture: deny by default. There is no USING (true) policy in this file.
--
-- NOTE ON VIEWS: the public views in 0007 are owned by the migration role and
-- run as their owner, so they read the base tables without RLS. That is why the
-- base tables are ENABLE (not FORCE) ROW LEVEL SECURITY — and why the anon role
-- still needs no grant on any base table. Two independent barriers.
-- =============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','roles','permissions','role_permissions','user_roles',
    'branches','products','capacities','colors','product_variants','product_specs',
    'devices_stock','variant_pricing','price_history','stock_history',
    'reservations','reservation_pricing','reservation_status_history','qr_scans',
    'admin_audit_logs','notification_logs','analytics_events','rate_limits','app_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Identity
-- -----------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_manage on public.profiles;
create policy profiles_manage on public.profiles for all to authenticated
  using (public.has_permission('manage_users'))
  with check (public.has_permission('manage_users'));

drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles for select to authenticated
  using (public.is_staff());

drop policy if exists roles_manage on public.roles;
create policy roles_manage on public.roles for all to authenticated
  using (public.has_permission('manage_users'))
  with check (public.has_permission('manage_users'));

drop policy if exists permissions_select on public.permissions;
create policy permissions_select on public.permissions for select to authenticated
  using (public.is_staff());

drop policy if exists permissions_manage on public.permissions;
create policy permissions_manage on public.permissions for all to authenticated
  using (public.has_permission('manage_users'))
  with check (public.has_permission('manage_users'));

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions for select to authenticated
  using (public.is_staff());

drop policy if exists role_permissions_manage on public.role_permissions;
create policy role_permissions_manage on public.role_permissions for all to authenticated
  using (public.has_permission('manage_users'))
  with check (public.has_permission('manage_users'));

drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists user_roles_manage on public.user_roles;
create policy user_roles_manage on public.user_roles for all to authenticated
  using (public.has_permission('manage_users'))
  with check (public.has_permission('manage_users'));

-- -----------------------------------------------------------------------------
-- Catalog — staff read, manage_products write. Customers use the views.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['branches','products','capacities','colors','product_variants','product_specs'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (public.is_staff())', t, t);
    execute format('drop policy if exists %I_manage on public.%I', t, t);
    execute format(
      'create policy %I_manage on public.%I for all to authenticated '
      'using (public.has_permission(''manage_products'')) '
      'with check (public.has_permission(''manage_products''))', t, t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Inventory
-- -----------------------------------------------------------------------------
drop policy if exists stock_select on public.devices_stock;
create policy stock_select on public.devices_stock for select to authenticated
  using (public.has_permission('view_reservations') or public.has_permission('manage_stock'));

drop policy if exists stock_manage on public.devices_stock;
create policy stock_manage on public.devices_stock for all to authenticated
  using (public.has_permission('manage_stock'))
  with check (public.has_permission('manage_stock'));

drop policy if exists stock_history_select on public.stock_history;
create policy stock_history_select on public.stock_history for select to authenticated
  using (public.has_permission('view_reservations') or public.has_permission('manage_stock'));

drop policy if exists stock_history_insert on public.stock_history;
create policy stock_history_insert on public.stock_history for insert to authenticated
  with check (public.has_permission('manage_stock'));

-- -----------------------------------------------------------------------------
-- 🔒 PRICING — the tightest policies in the system.
--
-- No SELECT policy exists for anon, and anon holds no grant either. An admin
-- without view_prices sees nothing here, which is what lets a counter staff
-- account manage reservations without ever seeing margins.
-- -----------------------------------------------------------------------------
drop policy if exists pricing_select on public.variant_pricing;
create policy pricing_select on public.variant_pricing for select to authenticated
  using (public.has_permission('view_prices'));

drop policy if exists pricing_manage on public.variant_pricing;
create policy pricing_manage on public.variant_pricing for all to authenticated
  using (public.has_permission('manage_prices'))
  with check (public.has_permission('manage_prices'));

drop policy if exists price_history_select on public.price_history;
create policy price_history_select on public.price_history for select to authenticated
  using (public.has_permission('view_prices'));

drop policy if exists price_history_insert on public.price_history;
create policy price_history_insert on public.price_history for insert to authenticated
  with check (public.has_permission('manage_prices'));

drop policy if exists reservation_pricing_select on public.reservation_pricing;
create policy reservation_pricing_select on public.reservation_pricing for select to authenticated
  using (public.has_permission('view_prices'));
-- No INSERT/UPDATE/DELETE policy at all: only the SECURITY DEFINER reservation
-- engine writes this table, and a trigger blocks mutation afterwards.

-- -----------------------------------------------------------------------------
-- Reservations
-- -----------------------------------------------------------------------------
drop policy if exists reservations_select on public.reservations;
create policy reservations_select on public.reservations for select to authenticated
  using (public.has_permission('view_reservations'));

drop policy if exists reservations_update on public.reservations;
create policy reservations_update on public.reservations for update to authenticated
  using (public.has_permission('manage_reservations'))
  with check (public.has_permission('manage_reservations'));
-- No INSERT policy: reservations are created only by create_reservation().
-- No DELETE policy: reservations are cancelled, never deleted.

drop policy if exists status_history_select on public.reservation_status_history;
create policy status_history_select on public.reservation_status_history for select to authenticated
  using (public.has_permission('view_reservations'));

drop policy if exists status_history_insert on public.reservation_status_history;
create policy status_history_insert on public.reservation_status_history for insert to authenticated
  with check (public.has_permission('manage_reservations'));

drop policy if exists qr_scans_select on public.qr_scans;
create policy qr_scans_select on public.qr_scans for select to authenticated
  using (public.has_permission('view_reservations') or public.has_permission('view_audit_logs'));

drop policy if exists qr_scans_insert on public.qr_scans;
create policy qr_scans_insert on public.qr_scans for insert to authenticated
  with check (public.has_permission('scan_qr'));

-- -----------------------------------------------------------------------------
-- Operations
-- -----------------------------------------------------------------------------
drop policy if exists audit_select on public.admin_audit_logs;
create policy audit_select on public.admin_audit_logs for select to authenticated
  using (public.has_permission('view_audit_logs'));
-- No INSERT policy for authenticated: write_audit() is SECURITY DEFINER.
-- No UPDATE/DELETE policy for anyone, plus an append-only trigger.

drop policy if exists notifications_select on public.notification_logs;
create policy notifications_select on public.notification_logs for select to authenticated
  using (public.has_permission('view_reservations'));

drop policy if exists analytics_select on public.analytics_events;
create policy analytics_select on public.analytics_events for select to authenticated
  using (public.has_permission('view_audit_logs'));
-- Analytics are written server-side only; there is no client INSERT policy.

drop policy if exists settings_select on public.app_settings;
create policy settings_select on public.app_settings for select to authenticated
  using (public.is_staff());

drop policy if exists settings_manage on public.app_settings;
create policy settings_manage on public.app_settings for all to authenticated
  using (public.has_permission('manage_settings'))
  with check (public.has_permission('manage_settings'));

-- rate_limits intentionally has RLS enabled and ZERO policies: only the
-- service role (which bypasses RLS) ever touches it.
