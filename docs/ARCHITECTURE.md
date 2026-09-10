# Al-Murshid / المرشد — Architecture

**Premium iPhone pre-order platform · Next.js 15 (App Router) + Supabase/PostgreSQL**

> This document is the contract for the build. Every later phase implements what is written here.
> Values Al-Murshid must configure before production are marked **`⚙️ CONFIGURE`**.

---

## 1. Guiding constraints

Three constraints shape every decision in this system:

| # | Constraint | Architectural consequence |
|---|---|---|
| 1 | **Prices are never public.** | Prices live in *separate tables* (`variant_pricing`, `reservation_pricing`), never as a column on any table a customer can reach. Public reads go through views that physically cannot select a price column. |
| 2 | **Stock must never go negative, ever, under concurrency.** | Reservation creation is a single `SECURITY DEFINER` PL/pgSQL function that takes a `FOR UPDATE` row lock on the stock row, backed by a `CHECK (quantity >= 0)` constraint. There is no application-level "read then write". |
| 3 | **The client is never trusted.** | The browser holds only the `anon` key. The `anon` role has `EXECUTE` on **zero** mutating functions and `SELECT` on **zero** base tables — only on three read-only public views. All writes go through Server Actions → service-role client → RPC. |

---

## 2. System overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BROWSER (anon key only)                         │
│  Landing (RSC)   Booking wizard (client)   /track (RSC+action)         │
│  Admin UI (client, session cookie)                                     │
└───────────────┬───────────────────────────────┬────────────────────────┘
                │ Server Actions / Route Handlers│ Supabase Auth (cookies)
┌───────────────▼───────────────────────────────▼────────────────────────┐
│                   NEXT.JS SERVER (Node runtime)                        │
│  • Zod validation      • DB-backed rate limiting                       │
│  • Token generation    • Response whitelisting (DTO mappers)           │
│  • createServiceClient()  ← SERVICE_ROLE_KEY, server-only import guard │
│  • createServerClient()   ← user session, for admin reads under RLS    │
└───────────────┬────────────────────────────────────────────────────────┘
                │ PostgREST / RPC
┌───────────────▼────────────────────────────────────────────────────────┐
│                       SUPABASE / POSTGRESQL                            │
│  RLS on every table · SECURITY DEFINER RPCs · CHECK constraints        │
│  Append-only audit · Row locks · Unique constraints                    │
└────────────────────────────────────────────────────────────────────────┘
```

### Trust boundaries

| Boundary | What crosses it | Enforcement |
|---|---|---|
| Browser → Next server | Untyped JSON | Zod schema, then re-derived server-side (price, stock, status are **never** read from the request) |
| Next server → Postgres | RPC arguments | `SECURITY DEFINER` functions re-validate every business rule |
| Postgres → Browser (direct, anon key) | 3 read-only views only | `REVOKE ALL ON ALL TABLES FROM anon`, then targeted `GRANT SELECT` on views |

---

## 3. Database schema

### 3.1 Entity groups

**Identity & authorization** — `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`
**Catalog** — `products`, `capacities`, `colors`, `product_variants`, `branches`
**Commerce state** — `devices_stock`, `variant_pricing` *(private)*
**Transactions** — `reservations`, `reservation_pricing` *(private)*, `reservation_status_history`, `qr_scans`
**History & ops** — `price_history`, `stock_history`, `admin_audit_logs`, `notification_logs`, `analytics_events`, `rate_limits`, `app_settings`

### 3.2 ERD

```
auth.users ──1:1── profiles ──1:N── user_roles ──N:1── roles ──1:N── role_permissions ──N:1── permissions
                       │
                       ├──< price_history.changed_by
                       ├──< stock_history.changed_by
                       ├──< admin_audit_logs.actor_id
                       └──< qr_scans.scanned_by

products ──1:N──┐
capacities ─1:N─┼──> product_variants ──1:1── devices_stock       (public availability derives from here)
colors ────1:N──┘         │        └──1:1── variant_pricing       🔒 PRIVATE — admin/service only
                          │        └──1:N── price_history         🔒 append-only
                          │        └──1:N── stock_history
                          │
                          └──1:N── reservations ──1:1── reservation_pricing   🔒 PRIVATE snapshot
                                        │       └──1:N── reservation_status_history
                                        │       └──1:N── qr_scans
                                        │       └──1:N── notification_logs
                                        └──N:1── branches (pickup only)

app_settings   (singleton key/value, is_public flag gates anon visibility)
rate_limits    (bucket + identifier hash + window)
analytics_events (no PII, session hash only)
```

### 3.3 Why prices sit in their own tables

This is the single most important schema decision.

```sql
-- ❌ NOT done — one forgotten column in a SELECT * leaks the whole pricing strategy
create table product_variants (..., price_lyd numeric);

-- ✅ Done — a leak requires an explicit, deliberate join that anon has no grant for
create table variant_pricing (variant_id uuid primary key references product_variants, price_lyd numeric);
create table reservation_pricing (reservation_id uuid primary key references reservations, price_at_reservation numeric);
```

Consequences:
- `select * from product_variants` — safe by construction.
- The customer-facing tracking RPC returns a hand-listed column set; even if it were changed to `select *`, no price exists on `reservations`.
- RLS on `variant_pricing` / `reservation_pricing` requires `has_permission('view_prices')`. `anon` has **no grant at all** on these tables, so RLS is the second line, not the first.

### 3.4 Integrity enforced by the database (not by app code)

| Rule | Mechanism |
|---|---|
| Stock never negative | `CHECK (quantity >= 0 AND reserved_quantity >= 0)` on `devices_stock` |
| Reservation code unique | `UNIQUE` + `CHECK (code ~ '^MRSH-[0-9A-HJ-NP-TV-Z]{6}$')` |
| Price non-negative & sane | `CHECK (price_lyd >= 0 AND price_lyd < 1000000)` |
| One variant per (model, capacity, color) | `UNIQUE (product_id, capacity_id, color_id)` |
| Pickup ⇒ branch present; Delivery ⇒ city present | table-level `CHECK` on `reservations` |
| Stock restored exactly once | `reservations.stock_released boolean` flag, flipped inside the same locked transaction that restores it |
| QR used once | `reservations.qr_used_at` set under `FOR UPDATE`; second attempt sees non-null |
| Audit log immutable | `REVOKE UPDATE, DELETE` + `BEFORE UPDATE OR DELETE` trigger raising an exception |
| Valid status transitions | `is_valid_transition(from, to)` SQL function called by the status RPC |

---

## 4. Roles, permissions, RLS strategy

### 4.1 Permission catalogue

`view_reservations` · `manage_reservations` · `manage_stock` · `view_prices` · `manage_prices` · `scan_qr` · `view_audit_logs` · `manage_settings` · `manage_products` · `manage_users` · `export_data`

| Role | Grants |
|---|---|
| `admin` | all of the above |
| `manager` | all except `manage_users` |
| `staff` | `view_reservations`, `manage_reservations`, `scan_qr` |

Permissions are **rows**, not code. Adding a role or moving a permission is a `INSERT`/`DELETE` in `role_permissions`, no redeploy.

### 4.2 The RLS shape

Every table: `ALTER TABLE … ENABLE ROW LEVEL SECURITY` **and** `FORCE ROW LEVEL SECURITY` where relevant. Default posture is *deny*; there is no `USING (true)` policy anywhere.

```sql
-- The one helper every admin policy is built on.
create function public.has_permission(p_key text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from user_roles ur
    join role_permissions rp on rp.role_key = ur.role_key
    join profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and rp.permission_key = p_key and p.is_active
  );
$$;
```

| Table | anon | authenticated (staff/manager/admin) |
|---|---|---|
| `product_variants`, `products`, `colors`, `capacities` | ❌ no grant (reads go via view) | SELECT for any active profile; write needs `manage_products` |
| `devices_stock` | ❌ | SELECT needs `view_reservations`; write needs `manage_stock` |
| `variant_pricing`, `price_history` | ❌ **no grant** | SELECT needs `view_prices`; write needs `manage_prices` |
| `reservations` | ❌ | SELECT needs `view_reservations`; UPDATE needs `manage_reservations` |
| `reservation_pricing` | ❌ **no grant** | SELECT needs `view_prices` |
| `admin_audit_logs` | ❌ | SELECT needs `view_audit_logs`; INSERT service-role only; UPDATE/DELETE blocked for everyone |
| `app_settings` | ❌ (reads go via `public_settings` view, `is_public = true` rows only) | SELECT any; write needs `manage_settings` |
| `v_public_variants`, `v_public_settings`, `v_public_branches` | ✅ SELECT | ✅ |

**Customers have no Supabase identity.** They never authenticate. Every customer-facing read/write is a Server Action calling a service-role RPC that returns a hand-built JSON payload. This removes an entire class of RLS mistakes — there is no "customer" policy to get wrong.

### 4.3 Public views

```sql
create view public.v_public_variants
with (security_invoker = false) as   -- runs as owner, so anon needs no table grants
select v.id, p.slug, p.name_ar, c.key as capacity, col.key as color_key, col.name_ar as color_name,
       col.hex,
       case when s.quantity = 0 then 'SOLD_OUT'
            when s.quantity <= s.low_stock_threshold then 'LIMITED'
            else 'IN_STOCK' end as availability
from product_variants v ... ;
```
No `quantity`. No price. The *state* is exposed, the *number* is not. If Al-Murshid ever wants exact counts public, `app_settings.show_exact_stock` flips it — the view reads that setting.

---

## 5. Atomic reservation strategy

`public.create_reservation(...)` — one function, one transaction, `SECURITY DEFINER`, granted **only to `service_role`**.

```
BEGIN (implicit — the function body is the transaction)

 1. idempotency        SELECT existing reservation by idempotency_key → return it unchanged
 2. settings gate      booking_enabled? maintenance_mode? now() >= booking_launch_at?   → RAISE 'BOOKING_CLOSED'
 3. variant validity   variant active, product active AND bookable, colour active       → RAISE 'INVALID_VARIANT'
 4. delivery gate      pickup_enabled / delivery_enabled; branch active                 → RAISE 'DELIVERY_UNAVAILABLE'
 5. 🔒 LOCK            SELECT ... FROM devices_stock WHERE variant_id = $1 FOR UPDATE
                       ← every concurrent caller for this variant serialises here
 6. stock check        quantity < 1                                                     → RAISE 'OUT_OF_STOCK'
 7. deduct             UPDATE devices_stock SET quantity = quantity - 1,
                                                reserved_quantity = reserved_quantity + 1
                       ← CHECK (quantity >= 0) is the backstop if logic is ever wrong
 8. price snapshot     SELECT price_lyd FROM variant_pricing FOR SHARE                   → RAISE 'PRICE_NOT_SET'
 9. code               loop generate_reservation_code() until unique (bounded, 12 tries)
10. INSERT reservations       (no price column exists here)
11. INSERT reservation_pricing (the snapshot — immutable afterwards)
12. INSERT reservation_status_history (NULL → RECEIVED, actor SYSTEM)
13. INSERT stock_history       (RESERVATION_HOLD, links reservation_id)
14. INSERT admin_audit_logs    (actor SYSTEM)
15. INSERT notification_logs   (event RESERVATION_CREATED, status QUEUED)
16. RETURN json — code, product, capacity, colour, delivery, expires_at.  NO PRICE.

Any RAISE ⇒ full rollback: no stock movement, no reservation, no history rows.
```

**Concurrency proof.** With `stock.quantity = 1` and two sessions calling simultaneously: session A acquires the row lock at step 5; session B blocks. A deducts to 0 and commits. B's lock is granted, B re-reads `quantity = 0` *inside the lock* and raises `OUT_OF_STOCK`. Exactly one reservation. This is verified by an actual concurrency test in `tests/` run against real PostgreSQL, not asserted.

**Why not optimistic (`UPDATE … WHERE quantity > 0`)?** It would also be correct for the decrement, but the price snapshot, code generation and history writes need to be in the same serialised critical section to stay consistent, and a pessimistic lock makes the invariant obvious to the next engineer reading it.

### 5.1 Stock restoration — exactly once

`cancel_reservation` and `expire_reservations` both:

```sql
select * into r from reservations where id = ? for update;   -- serialise
if r.stock_released then return;  end if;                    -- idempotent guard
update devices_stock set quantity = quantity + 1, reserved_quantity = reserved_quantity - 1 ...;
update reservations set stock_released = true, status = ? ...;
```

The `FOR UPDATE` + boolean flag means a double-click, a retried cron run and a race between cancel-and-expire all converge on one restoration.

---

## 6. Reservation lifecycle

```
                 ┌─────────────► CANCELLED (stock restored once)
                 │
RECEIVED ──► CONFIRMED ──► READY ──┬──► OUT_FOR_DELIVERY ──► DELIVERED
    │                              └──► DELIVERED (pickup)
    └──► EXPIRED (stock restored once, by scheduled job)
```

| Status | Arabic |
|---|---|
| `RECEIVED` | تم استلام الطلب |
| `CONFIRMED` | تم تأكيد الحجز |
| `READY` | الجهاز جاهز |
| `OUT_FOR_DELIVERY` | قيد التوصيل |
| `DELIVERED` | تم التسليم |
| `CANCELLED` | تم إلغاء الحجز |
| `EXPIRED` | انتهت صلاحية الحجز |

`OUT_FOR_DELIVERY` is rejected for pickup reservations. `DELIVERED`, `CANCELLED`, `EXPIRED` are terminal. Transitions are validated in SQL, so an admin UI bug cannot produce an impossible state.

Expiry window: `app_settings.reservation_expiry_hours` — **`⚙️ CONFIGURE`**, seeded at 48.

---

## 7. Reservation code & QR security model

**Reservation code** — `MRSH-` + 6 chars from Crockford-style alphabet `0-9 A-Z` minus `I L O U`. 32⁶ ≈ 1.07 billion. Non-sequential, generated by `gen_random_bytes`, safe to read aloud on the phone. It is an *identifier*, not a secret.

**Access token** — 32 random bytes, base64url, generated in the Next.js server, **stored only as SHA-256** (`access_token_hash`). The raw token is:
- embedded in the QR payload as `MRSH1:<code>:<token>`,
- put in the confirmation URL so the customer can bookmark their reservation,
- never stored in plaintext anywhere.

**Why the QR carries a token and not a database id:** the QR is a bearer credential shown at the counter. A UUID would be an IDOR waiting to happen; a code alone would be brute-forceable. The token makes possession of the QR the proof.

The QR contains **no name, no phone, no city, no price** — only the code and the token.

**Scan flow (server-side only):** hash token → find reservation by code → constant-time compare hash → check status ∈ {`CONFIRMED`, `READY`} → check `qr_used_at IS NULL` under `FOR UPDATE` → stamp `qr_used_at`/`qr_used_by` → write `qr_scans` row → write audit row. Every outcome (`VALID`, `ALREADY_USED`, `INVALID`, `NOT_ELIGIBLE`) is recorded, including failures, so brute-force attempts are visible.

**Tracking (`/track`)** requires **code + phone number**. The phone is compared after normalisation, server-side, and the endpoint is rate-limited per IP *and* per code. Wrong phone returns the same generic error and the same timing profile as an unknown code — no enumeration oracle.

---

## 8. Rate limiting

Vercel functions are stateless, so limits live in Postgres: `check_rate_limit(bucket, identifier_hash, max, window_seconds)` does an upsert on `(bucket, identifier_hash, window_start)` and returns allowed/remaining. Identifiers are **hashed** IPs — the raw IP is never stored.

| Bucket | Limit | Key |
|---|---|---|
| `reservation_create` | 3 / 10 min | IP hash |
| `reservation_create_phone` | 2 / hour | phone hash |
| `track_lookup` | 10 / 10 min | IP hash |
| `qr_validate` | 60 / min | admin user |
| `admin_login` | 5 / 15 min | IP hash |

A Turnstile/CAPTCHA hook point exists on the reservation action (`lib/security/captcha.ts`) — disabled until **`⚙️ CONFIGURE`** supplies keys.

---

## 9. Folder structure

```
app/
  (marketing)/page.tsx           landing (RSC) + 13 sections
  book/                          multi-step wizard (client island)
  reservation/[code]/            confirmation + QR (token in query)
  track/                         lookup form + timeline
  admin/                         layout guard, dashboard, reservations, pricing,
                                 stock, scan, audit, settings
  api/                           route handlers: sitemap, robots, cron/expire, health
components/  ui/ hero/ product/ booking/ tracking/ admin/ 3d/ layout/
lib/         supabase/  validation/  security/  reservations/  stock/  pricing/
             settings/  notifications/  analytics/  utils/
stores/      booking-store.ts (Zustand)
types/       database.ts (generated), domain.ts, dto.ts
config/      site.ts, brand.ts, product-content.ts, statuses.ts
supabase/    migrations/*.sql, seed.sql, tests/
tests/       unit/, integration/, sql/
```

**Server-only guard.** `lib/supabase/service.ts` starts with `import 'server-only'` — importing it from a Client Component is a *build* error, not a runtime surprise. Same for `lib/pricing/*`.

---

## 10. Dependencies

`next` · `react` · `react-dom` · `typescript` · `tailwindcss` · `@supabase/supabase-js` · `@supabase/ssr` · `framer-motion` · `three` · `@react-three/fiber` · `@react-three/drei` · `zustand` · `react-hook-form` · `zod` · `@hookform/resolvers` · `react-qr-code` · `lucide-react` · `server-only` · `vitest` · `@testing-library/react` · `pg` (tests only)

---

## 11. Implementation phases

| Phase | Content |
|---|---|
| 1 | Scaffold, config, `.env.example`, migrations 0001–0006 (schema) |
| 2 | Auth, roles, permissions, RLS policies, grants, admin middleware |
| 3 | Products / variants / inventory + public views |
| 4 | Private pricing + history |
| 5 | Atomic reservation RPC, cancel, expire, rate limits |
| 6 | Booking wizard UI |
| 7 | Confirmation + QR |
| 8 | Tracking |
| 9 | Admin dashboard |
| 10 | Landing page + motion |
| 11 | 3D / 360° |
| 12 | Tests + security audit |
| 13 | SEO, performance, deployment |

---

## 12. Edge cases handled

- Two customers, last unit, same millisecond → one succeeds *(tested against real Postgres)*
- Double-click / retried submit → idempotency key returns the first reservation
- Admin raises price mid-checkout → the snapshot taken inside the transaction wins
- Price not set for a variant → reservation refused, not created at price 0
- Countdown reaches zero on a stale client → server re-checks `booking_launch_at` and rejects
- Clock skew between client and server → countdown is driven by a server-sent timestamp, not `Date.now()`
- `/public/models/iphone.glb` missing → error boundary renders the still image, page stays interactive
- WebGL unavailable / low-power device / `prefers-reduced-motion` → 3D never mounts
- Cancel and expire racing the same reservation → `stock_released` flag, restored once
- QR scanned twice → second scan returns `تم استخدام رمز QR مسبقًا`, recorded
- Reservation enumeration → code+phone required, rate-limited, uniform errors
- Booking paused mid-session → UI disables *and* server rejects
- Long Arabic names / RTL + Latin digits mixing → `dir="rtl"`, `bdi` for phone numbers

## 13. Technical risks

| Risk | Mitigation |
|---|---|
| Service-role key leaking into a client bundle | `import 'server-only'`, key read via a single accessor, never `NEXT_PUBLIC_` |
| RLS regression on a future table | Migration `9999_assert_rls.sql` fails if any public table has RLS disabled |
| Row-lock contention on a viral launch | Lock is per-variant and held for ~1ms; contention is bounded per SKU |
| Long-running expiry job | `expire_reservations(batch_limit)` processes in bounded batches, idempotent |
| 3D bundle weight | `next/dynamic` with `ssr: false`, mounted by `IntersectionObserver` |
| Supabase connection limits | Server Actions use short-lived clients; PostgREST pools |
| Unannounced product specs treated as fact | Every spec row is `is_confirmed` in the DB; unconfirmed renders as "يُعلن لاحقًا" |

---

## 14. Values Al-Murshid must configure

| Setting | Where | Seeded as |
|---|---|---|
| Booking launch date/time | `app_settings.booking_launch_at` | placeholder, 30 days out |
| Reservation expiry hours | `app_settings.reservation_expiry_hours` | 48 |
| Branch names, addresses, phones | `branches` | 2 clearly-marked placeholder branches |
| Contact phone / WhatsApp / socials | `app_settings` | placeholders |
| Internal prices | `variant_pricing` | fictional dev prices, must be replaced |
| Product specifications | `product_specs` | `is_confirmed = false` placeholders |
| Hero imagery, `iphone.glb` | `public/` | absent by design; fallbacks render |
| Delivery policy, warranty, payment terms | `app_settings.trust_*` | empty — the UI omits the section rather than inventing terms |
