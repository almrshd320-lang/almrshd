-- =============================================================================
-- 0011 — Grants
--
-- RLS decides which ROWS a role may touch. Grants decide which OBJECTS it may
-- name at all. Both are used: anon is not merely policy-denied on the private
-- tables, it has no privilege on them, so a policy mistake is not sufficient to
-- cause a leak.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Reset. Start from zero for the two browser-reachable roles.
-- -----------------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- ANONYMOUS (the browser key): three read-only views. Nothing else. No table.
-- No function. No sequence.
-- -----------------------------------------------------------------------------
grant select on public.v_public_variants to anon, authenticated;
grant select on public.v_public_products to anon, authenticated;
grant select on public.v_public_specs    to anon, authenticated;
grant select on public.v_public_branches to anon, authenticated;
grant select on public.v_public_settings to anon, authenticated;

-- -----------------------------------------------------------------------------
-- AUTHENTICATED (staff sessions): table access gated by the RLS policies in 0010.
--
-- variant_pricing / reservation_pricing / price_history ARE listed here, because
-- their policies require view_prices — a staff account without that permission
-- is denied at the row level and sees an empty set.
-- -----------------------------------------------------------------------------
grant select on
  public.profiles, public.roles, public.permissions, public.role_permissions,
  public.user_roles, public.branches, public.products, public.capacities,
  public.colors, public.product_variants, public.product_specs,
  public.devices_stock, public.variant_pricing, public.price_history,
  public.stock_history, public.reservations, public.reservation_pricing,
  public.reservation_status_history, public.qr_scans, public.admin_audit_logs,
  public.notification_logs, public.analytics_events, public.app_settings
to authenticated;

grant insert, update, delete on
  public.branches, public.products, public.capacities, public.colors,
  public.product_variants, public.product_specs, public.devices_stock,
  public.variant_pricing, public.app_settings, public.profiles,
  public.user_roles, public.role_permissions, public.roles
to authenticated;

grant insert on
  public.price_history, public.stock_history,
  public.reservation_status_history, public.qr_scans
to authenticated;

grant update on public.reservations to authenticated;
-- Deliberately NOT granted to authenticated:
--   insert/delete on reservations            → only create_reservation()
--   any write on reservation_pricing         → immutable snapshot
--   any write on admin_audit_logs            → only write_audit()
--   any privilege on rate_limits             → service role only

-- -----------------------------------------------------------------------------
-- SERVICE ROLE: full access. This key lives only in the Next.js server runtime.
-- -----------------------------------------------------------------------------
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- -----------------------------------------------------------------------------
-- FUNCTIONS
-- -----------------------------------------------------------------------------

-- Customer-facing engine: service_role ONLY. The browser cannot call these even
-- with a valid anon key — every customer path goes through a Server Action.
grant execute on function public.create_reservation(
  uuid, text, text, text, public.delivery_method, text, uuid, text, text, text
) to service_role;
grant execute on function public.track_reservation(text, text)                to service_role;
grant execute on function public.get_reservation_by_token(text, text)         to service_role;
grant execute on function public.release_reservation_stock(uuid, public.stock_change_reason, text)
                                                                              to service_role;
grant execute on function public.expire_reservations(integer)                 to service_role;
grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.prune_rate_limits()                          to service_role;
grant execute on function public.reservation_public_payload(uuid)             to service_role;
grant execute on function public.booking_window_state()                       to service_role, authenticated;

-- Authorization helpers: readable by any signed-in staff member.
grant execute on function public.has_permission(text)  to authenticated, service_role;
grant execute on function public.has_role(text)        to authenticated, service_role;
grant execute on function public.is_staff()            to authenticated, service_role;
grant execute on function public.my_permissions()      to authenticated, service_role;
grant execute on function public.require_permission(text) to authenticated, service_role;
grant execute on function public.is_valid_status_transition(
  public.reservation_status, public.reservation_status, public.delivery_method
) to authenticated, service_role;

-- Admin RPCs: authenticated, then permission-checked inside. Not service_role —
-- they need a real auth.uid() so the audit trail names a person.
grant execute on function public.admin_set_price(uuid, numeric, text)                          to authenticated;
grant execute on function public.admin_set_stock(uuid, integer, text)                          to authenticated;
grant execute on function public.admin_adjust_stock(uuid, integer, text)                       to authenticated;
grant execute on function public.admin_update_reservation_status(
  uuid, public.reservation_status, text)                                                       to authenticated;
grant execute on function public.admin_validate_qr(text, text, uuid)                           to authenticated;
grant execute on function public.admin_dashboard_metrics()                                     to authenticated;
grant execute on function public.admin_reservation_detail(uuid)                                to authenticated;
grant execute on function public.admin_pricing_overview()                                      to authenticated;
grant execute on function public.admin_price_history(uuid, integer)                            to authenticated;
grant execute on function public.admin_anonymize_reservation(uuid, text)                       to authenticated;

-- Utility functions used by server code.
grant execute on function public.normalize_libyan_phone(text) to authenticated, service_role;
grant execute on function public.mask_phone(text)             to authenticated, service_role;
grant execute on function public.sha256_hex(text)             to service_role;
grant execute on function public.write_audit(
  text, text, text, jsonb, jsonb, text, uuid, public.actor_type, uuid, uuid, text
) to service_role;
grant execute on function public.get_setting(text)              to service_role;
grant execute on function public.get_setting_bool(text, boolean) to service_role;
grant execute on function public.get_setting_int(text, integer)  to service_role;
grant execute on function public.get_setting_ts(text)            to service_role;
grant execute on function public.generate_reservation_code()     to service_role;

-- -----------------------------------------------------------------------------
-- Future objects inherit the same posture: nothing for anon by default.
-- -----------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema public grant all on tables     to service_role;
alter default privileges in schema public grant all on sequences  to service_role;
alter default privileges in schema public grant execute on functions to service_role;
