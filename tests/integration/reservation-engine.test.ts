import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool, type PoolClient } from 'pg';

/**
 * Integration tests against a REAL PostgreSQL database.
 *
 * Set up the database first:
 *   ./scripts/db-local.sh almurshid_test
 *   TEST_DATABASE_URL=postgres://postgres@localhost:5432/almurshid_test npm test
 *
 * Without TEST_DATABASE_URL the whole suite is skipped, so `npm test` still
 * passes on a machine with no Postgres.
 *
 * These cover the invariants that cannot be verified any other way: real
 * concurrency, real row locks, real constraints. A mocked database would prove
 * only that the mock behaves as written.
 */

const connectionString = process.env.TEST_DATABASE_URL;
const describeDb = connectionString ? describe : describe.skip;

describeDb('reservation engine (real PostgreSQL)', () => {
  let pool: Pool;
  let variantId: string;
  let branchId: string;

  const token = () => `tok-${Math.random().toString(36).slice(2)}${Date.now()}`;
  const phone = (n: number) => `091${String(n).padStart(7, '0')}`;

  beforeAll(async () => {
    pool = new Pool({ connectionString, max: 30 });

    // Open the booking window; the seed deliberately ships it closed.
    await pool.query(`
      update app_settings
         set value = to_jsonb((now() - interval '1 hour')::text)
       where key = 'booking_launch_at'`);
    await pool.query(`update app_settings set value = 'false'::jsonb where key = 'maintenance_mode'`);
    await pool.query(`update app_settings set value = 'true'::jsonb where key = 'booking_enabled'`);

    const variant = await pool.query(`
      select v.id from product_variants v
      join products p on p.id = v.product_id
      where p.is_bookable and v.is_active
      limit 1`);
    variantId = variant.rows[0].id;

    const branch = await pool.query(`select id from branches where is_active limit 1`);
    branchId = branch.rows[0].id;
  });

  afterAll(async () => {
    await pool?.end();
  });

  const setStock = (quantity: number) =>
    pool.query(
      `update devices_stock set quantity = $1, reserved_quantity = 0 where variant_id = $2`,
      [quantity, variantId],
    );

  const reserve = (client: PoolClient | Pool, index: number, idempotencyKey?: string) =>
    client.query(
      `select create_reservation(
         p_variant_id        => $1::uuid,
         p_customer_name     => $2,
         p_customer_phone    => $3,
         p_customer_city     => 'طرابلس',
         p_delivery_method   => 'PICKUP'::delivery_method,
         p_access_token_hash => sha256_hex($4),
         p_branch_id         => $5::uuid,
         p_idempotency_key   => $6
       ) as payload`,
      [variantId, `اختبار ${index}`, phone(index), token(), branchId, idempotencyKey ?? null],
    );

  it('lets exactly one of many simultaneous customers take the last unit', async () => {
    await setStock(1);

    const attempts = 20;
    const results = await Promise.allSettled(
      Array.from({ length: attempts }, (_, i) => reserve(pool, i + 1)),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const outOfStock = results.filter(
      (r) => r.status === 'rejected' && String(r.reason?.message).includes('OUT_OF_STOCK'),
    );

    expect(succeeded).toHaveLength(1);
    expect(outOfStock).toHaveLength(attempts - 1);

    const { rows } = await pool.query(
      `select quantity, reserved_quantity from devices_stock where variant_id = $1`,
      [variantId],
    );
    expect(rows[0].quantity).toBe(0);
    expect(rows[0].reserved_quantity).toBe(1);
  }, 30_000);

  it('never allows negative stock anywhere', async () => {
    const { rows } = await pool.query(`select count(*)::int as n from devices_stock where quantity < 0`);
    expect(rows[0].n).toBe(0);

    await expect(
      pool.query(`update devices_stock set quantity = -1 where variant_id = $1`, [variantId]),
    ).rejects.toThrow();
  });

  it('returns the original reservation for a repeated idempotency key', async () => {
    await setStock(5);
    const key = `idem-${Date.now()}`;

    const first = await reserve(pool, 101, key);
    const second = await reserve(pool, 101, key);

    expect(second.rows[0].payload.code).toBe(first.rows[0].payload.code);
    expect(second.rows[0].payload.idempotent_replay).toBe(true);

    const { rows } = await pool.query(
      `select quantity from devices_stock where variant_id = $1`,
      [variantId],
    );
    // Five units, one reservation, one unit consumed — not two.
    expect(rows[0].quantity).toBe(4);
  });

  it('keeps a reservation on its original internal price after a price change', async () => {
    await setStock(5);
    await pool.query(
      `insert into variant_pricing (variant_id, price_lyd) values ($1, 5499)
       on conflict (variant_id) do update set price_lyd = 5499`,
      [variantId],
    );

    const created = await reserve(pool, 102);
    const code = created.rows[0].payload.code;

    await pool.query(`update variant_pricing set price_lyd = 6999 where variant_id = $1`, [variantId]);

    const { rows } = await pool.query(
      `select rp.price_at_reservation
         from reservation_pricing rp
         join reservations r on r.id = rp.reservation_id
        where r.code = $1`,
      [code],
    );
    expect(Number(rows[0].price_at_reservation)).toBe(5499);
  });

  it('never returns a price in the customer payload', async () => {
    await setStock(5);
    const created = await reserve(pool, 103);
    const serialised = JSON.stringify(created.rows[0].payload).toLowerCase();

    expect(serialised).not.toContain('price');
    expect(serialised).not.toContain('lyd');
    expect(serialised).not.toContain('5499');
  });

  it('restores stock exactly once, however many times release is called', async () => {
    await setStock(5);
    const created = await reserve(pool, 104);
    const code = created.rows[0].payload.code;

    const { rows: idRows } = await pool.query(`select id from reservations where code = $1`, [code]);
    const reservationId = idRows[0].id;

    const before = await pool.query(
      `select quantity from devices_stock where variant_id = $1`, [variantId],
    );

    // Three attempts, including two that race.
    await pool.query(`select release_reservation_stock($1, 'RESERVATION_RELEASE')`, [reservationId]);
    await Promise.all([
      pool.query(`select release_reservation_stock($1, 'RESERVATION_RELEASE')`, [reservationId]),
      pool.query(`select release_reservation_stock($1, 'RESERVATION_RELEASE')`, [reservationId]),
    ]);

    const after = await pool.query(
      `select quantity from devices_stock where variant_id = $1`, [variantId],
    );
    expect(after.rows[0].quantity).toBe(before.rows[0].quantity + 1);
  });

  it('refuses reservations before the launch moment', async () => {
    await setStock(5);
    await pool.query(`
      update app_settings set value = to_jsonb((now() + interval '10 days')::text)
       where key = 'booking_launch_at'`);

    await expect(reserve(pool, 105)).rejects.toThrow(/BOOKING_CLOSED:NOT_YET_OPEN/);

    await pool.query(`
      update app_settings set value = to_jsonb((now() - interval '1 hour')::text)
       where key = 'booking_launch_at'`);
  });

  it('refuses reservations while maintenance mode is on', async () => {
    await setStock(5);
    await pool.query(`update app_settings set value = 'true'::jsonb where key = 'maintenance_mode'`);

    await expect(reserve(pool, 106)).rejects.toThrow(/BOOKING_CLOSED:MAINTENANCE/);

    await pool.query(`update app_settings set value = 'false'::jsonb where key = 'maintenance_mode'`);
  });

  it('refuses an invalid phone number at the database boundary', async () => {
    await setStock(5);
    await expect(
      pool.query(
        `select create_reservation($1::uuid, 'اسم صحيح', '0812345678', 'طرابلس',
           'PICKUP'::delivery_method, sha256_hex('t'), $2::uuid)`,
        [variantId, branchId],
      ),
    ).rejects.toThrow(/INVALID_PHONE/);
  });

  it('finds a reservation by code + phone, and nothing by code alone', async () => {
    await setStock(5);
    const created = await reserve(pool, 107);
    const code = created.rows[0].payload.code;

    const hit = await pool.query(`select track_reservation($1, $2) as r`, [code, phone(107)]);
    expect(hit.rows[0].r?.code).toBe(code);

    const wrongPhone = await pool.query(`select track_reservation($1, '0919999999') as r`, [code]);
    expect(wrongPhone.rows[0].r).toBeNull();

    const unknownCode = await pool.query(
      `select track_reservation('MRSH-ZZZZZZ', $1) as r`, [phone(107)],
    );
    expect(unknownCode.rows[0].r).toBeNull();
  });

  it('generates codes that are unique and free of ambiguous characters', async () => {
    const { rows } = await pool.query(`
      select array_agg(generate_reservation_code()) as codes from generate_series(1, 1000)`);
    const codes: string[] = rows[0].codes;

    expect(new Set(codes).size).toBe(1000);
    expect(codes.every((c) => /^MRSH-[0-9A-HJKMNP-TV-Z]{6}$/.test(c))).toBe(true);
    expect(codes.some((c) => /[ILOU]/.test(c))).toBe(false);
  });

  it('keeps the audit log append-only', async () => {
    const { rows } = await pool.query(`select id from admin_audit_logs limit 1`);
    if (rows.length === 0) return;

    await expect(
      pool.query(`update admin_audit_logs set action = 'tampered' where id = $1`, [rows[0].id]),
    ).rejects.toThrow();

    await expect(
      pool.query(`delete from admin_audit_logs where id = $1`, [rows[0].id]),
    ).rejects.toThrow();
  });

  it('gives the anonymous role no access to anything private', async () => {
    const { rows } = await pool.query(`
      select
        has_table_privilege('anon', 'public.reservations',        'SELECT') as reservations,
        has_table_privilege('anon', 'public.variant_pricing',     'SELECT') as pricing,
        has_table_privilege('anon', 'public.reservation_pricing', 'SELECT') as snapshot,
        has_table_privilege('anon', 'public.devices_stock',       'SELECT') as stock,
        has_table_privilege('anon', 'public.admin_audit_logs',    'SELECT') as audit,
        has_table_privilege('anon', 'public.v_public_variants',   'SELECT') as public_view`);

    expect(rows[0]).toMatchObject({
      reservations: false,
      pricing: false,
      snapshot: false,
      stock: false,
      audit: false,
      public_view: true,
    });
  });

  it('exposes no price-shaped column on any anon-readable view', async () => {
    const { rows } = await pool.query(`
      select c.relname, a.attname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      where n.nspname = 'public' and c.relkind = 'v'
        and has_table_privilege('anon', c.oid, 'SELECT')
        and (a.attname ~* 'price' or a.attname ~* 'cost' or a.attname ~* 'lyd')`);

    expect(rows).toHaveLength(0);
  });

  it('has row level security enabled on every table', async () => {
    const { rows } = await pool.query(`
      select c.relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);

    expect(rows.map((r) => r.relname)).toEqual([]);
  });
});
