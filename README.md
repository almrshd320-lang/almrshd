# المرشد · Al-Murshid

**منصة الحجز المسبق لأجهزة آيفون** — Next.js 15 (App Router) · TypeScript · Supabase/PostgreSQL

An Arabic-first, RTL pre-order platform for a Libyan retailer. Real reservation
engine, real inventory, real Row Level Security. Nothing about the core flow is
mocked.

---

## The three constraints this codebase is built around

| Constraint | How it is actually enforced |
|---|---|
| **Prices are never public.** | Prices live in their own tables (`variant_pricing`, `reservation_pricing`), so no customer-facing query can reach them. The `anon` role holds no privilege on those tables, no public view selects a price column, and migration `0012` **fails the deploy** if a price-shaped column ever appears on an anon-readable view. |
| **Stock can never go negative, under any concurrency.** | Reservation creation is one PL/pgSQL function that takes a `FOR UPDATE` lock on the stock row, backed by `CHECK (quantity >= 0)`. Verified with 25 simultaneous reservations against one unit: exactly one winner. |
| **The client is never trusted.** | The browser holds only the `anon` key, which has `EXECUTE` on **zero** functions and `SELECT` on **zero** base tables — only five read-only views. Every write goes Server Action → service role → `SECURITY DEFINER` RPC that re-validates in SQL. |

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env.local
#    Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#    SUPABASE_SERVICE_ROLE_KEY, and generate IP_HASH_SALT + CRON_SECRET:
#      openssl rand -hex 32

# 3. Apply the database
supabase db push          # or paste supabase/migrations/*.sql in order
psql "$DATABASE_URL" -f supabase/seed.sql

# 4. Run
npm run dev
```

Full setup, admin bootstrap and production checklist: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

> The seed ships with booking **closed** and a launch date 30 days out, so a
> fresh install cannot accidentally take live reservations. To exercise the flow
> locally, set `booking_launch_at` to the past from the admin Settings screen.

---

## Verifying it works

The database layer can be tested without Supabase, against a plain PostgreSQL 16:

```bash
./scripts/db-local.sh almurshid_test    # shim + all migrations + seed
./scripts/test-db.sh                    # 60 behaviour/security assertions + concurrency
```

```
✓ exactly one winner, stock exact, nothing negative      (25 concurrent, 1 unit)
✓ existing reservation keeps its original internal price
✓ a second expiry run does not restore stock twice
✓ second scan is ALREADY_USED
✓ correct code + wrong phone returns nothing
✓ the internal price is withheld from a staff account
```

Application tests:

```bash
npm test                                                     # unit tests
TEST_DATABASE_URL=postgres://…/almurshid_test npm test        # + integration
```

---

## What is in here

```
app/
  (marketing)/          landing · /book · /track · /reservation/[code]
  admin/                login + guarded dashboard, pricing, stock, scan, audit, settings
  api/                  cron/expire · admin/export · health · print
components/             ui/ hero/ product/ booking/ tracking/ admin/ 3d/ layout/ sections/
lib/
  supabase/             browser · session · service-role (server-only)
  validation/           Zod schemas mirroring the SQL validators
  security/             tokens, hashed-identifier rate limiting, captcha hook
  reservations/         customer Server Actions
  admin/                admin Server Actions + queries
supabase/
  migrations/           0001-0013, idempotent, in order
  seed.sql              clearly-marked development data
  tests/                local Supabase shim for offline testing
tests/
  sql/                  behaviour + concurrency suites (real Postgres)
  unit/ integration/    vitest
```

---

## Key design decisions

**Prices in separate tables.** `select *` on `product_variants` or `reservations`
is safe by construction — there is no price column to leak. A price reaches the
UI only through `admin_reservation_detail()`, which returns `null` unless the
caller holds `view_prices`. A counter-staff account can run the entire
fulfilment workflow while being structurally unable to see margins.

**Customers have no Supabase identity.** They never authenticate. Every
customer read and write is a Server Action calling a service-role RPC that
returns a hand-built payload. This removes an entire class of RLS mistakes:
there is no "customer" policy to get wrong.

**The countdown is decoration.** `booking_window_state()` in SQL is the
authority, and `create_reservation()` consults it again inside the transaction.
A tab left open since before launch, or a device with a wrong clock, cannot slip
through. The countdown also counts against the *server's* timestamp, not
`Date.now()`.

**Access tokens live in the URL fragment.** `#t=…` is never sent to the server,
so the token stays out of request lines, access logs, referrers and history
sync. Only its SHA-256 is stored, so a database dump yields no working QR codes.

**History pins its parents.** Append-only tables carry no cascading foreign
keys — they use `ON DELETE RESTRICT`, and the actor is a denormalised uuid plus
email with *no* FK at all. An audit trail that can be erased by deleting the
account that produced it is not an audit trail.

**Unannounced specs are labelled.** `product_specs.is_confirmed = false` makes
the view withhold the value entirely, and the UI renders "يُعلن لاحقًا". The
platform never presents speculation as an official specification.

**Nothing is invented.** Delivery times, warranty, payment terms, branch
addresses and contact details are empty settings. The UI omits those blocks
rather than filling them with plausible fiction — see `⚙️ CONFIGURE` in
[docs/ARCHITECTURE.md §14](docs/ARCHITECTURE.md).

---

## Documentation

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — schema, ERD, RLS strategy, atomic reservation strategy, edge cases, risks
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — Supabase + Vercel setup, admin bootstrap, production checklist
- **[docs/SECURITY.md](docs/SECURITY.md)** — threat model and the audit performed against it

---

## Licence & attribution

Al-Murshid is an independent retailer. Product and brand names belong to their
respective owners; this platform's visual identity, mark and layouts are
original work and do not reproduce any manufacturer's branding or design.
