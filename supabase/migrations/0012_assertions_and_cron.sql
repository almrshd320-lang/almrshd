-- =============================================================================
-- 0012 — Self-checking migration + scheduled jobs
--
-- This migration FAILS the deploy if the security posture has regressed. It is
-- cheap insurance against the two mistakes that matter most: a table shipped
-- with RLS off, and a price column reaching a public surface.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Assertion 1 — every table in `public` has RLS enabled.
-- -----------------------------------------------------------------------------
do $$
declare v_offenders text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v_offenders
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if v_offenders is not null then
    raise exception 'SECURITY REGRESSION: RLS is disabled on: %', v_offenders;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Assertion 2 — the anonymous role holds no privilege on any BASE TABLE.
-- Its entire read surface is the v_public_* views.
-- -----------------------------------------------------------------------------
do $$
declare v_offenders text;
begin
  select string_agg(distinct c.relname, ', ') into v_offenders
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and (
      has_table_privilege('anon', c.oid, 'SELECT') or
      has_table_privilege('anon', c.oid, 'INSERT') or
      has_table_privilege('anon', c.oid, 'UPDATE') or
      has_table_privilege('anon', c.oid, 'DELETE')
    );

  if v_offenders is not null then
    raise exception 'SECURITY REGRESSION: anon has table privileges on: %', v_offenders;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Assertion 3 — no publicly readable view exposes anything price-shaped.
--
-- This is the guard that makes "prices are never public" a property of the
-- database rather than a promise in a code review.
-- -----------------------------------------------------------------------------
do $$
declare v_offenders text;
begin
  select string_agg(format('%s.%s', c.relname, a.attname), ', ') into v_offenders
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  where n.nspname = 'public'
    and c.relkind = 'v'
    and has_table_privilege('anon', c.oid, 'SELECT')
    and (a.attname ~* 'price' or a.attname ~* 'cost' or a.attname ~* 'lyd');

  if v_offenders is not null then
    raise exception 'PRICE LEAK: anon-readable view column(s): %', v_offenders;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Assertion 4 — the reservations table itself carries no price column.
-- -----------------------------------------------------------------------------
do $$
declare v_offenders text;
begin
  select string_agg(a.attname, ', ') into v_offenders
  from pg_attribute a
  where a.attrelid = 'public.reservations'::regclass
    and a.attnum > 0 and not a.attisdropped
    and (a.attname ~* 'price' or a.attname ~* 'amount' or a.attname ~* 'total');

  if v_offenders is not null then
    raise exception 'SCHEMA REGRESSION: reservations must not hold pricing columns: %', v_offenders;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Assertion 5 — anon cannot execute a single function in `public`.
-- -----------------------------------------------------------------------------
do $$
declare v_offenders text;
begin
  select string_agg(p.proname, ', ') into v_offenders
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  if v_offenders is not null then
    raise exception 'SECURITY REGRESSION: anon can execute: %', v_offenders;
  end if;
end $$;

-- =============================================================================
-- Scheduled jobs (pg_cron). Optional: if the extension is unavailable the
-- migration still succeeds and the /api/cron/expire route handler is used
-- instead (see docs/DEPLOYMENT.md).
-- =============================================================================
do $$
begin
  create extension if not exists pg_cron with schema extensions;

  -- Expire elapsed reservations and return their stock. Idempotent.
  perform extensions.cron.unschedule('al-murshid-expire-reservations')
  where exists (
    select 1 from extensions.cron.job where jobname = 'al-murshid-expire-reservations'
  );

  perform extensions.cron.schedule(
    'al-murshid-expire-reservations',
    '*/5 * * * *',
    $cron$ select public.expire_reservations(500); $cron$
  );

  perform extensions.cron.schedule(
    'al-murshid-prune-rate-limits',
    '17 3 * * *',
    $cron$ select public.prune_rate_limits(); $cron$
  );

  raise notice 'pg_cron jobs scheduled.';
exception when others then
  raise notice 'pg_cron unavailable (%). Use the /api/cron/expire route with an external scheduler.', sqlerrm;
end $$;
