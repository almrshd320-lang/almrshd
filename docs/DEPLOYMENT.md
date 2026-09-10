# Deployment

Supabase + Vercel. Roughly 30 minutes end to end.

---

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com). Pick the region
   closest to Libya — **Frankfurt (eu-central-1)** is currently the lowest
   latency option.
2. Project Settings → API. You need three values:

| Value | Where it goes | Notes |
|---|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | Public. |
| `anon` public key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public **and safe** — it can read five views and nothing else. |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` | **Secret.** Bypasses RLS entirely. Never prefix it with `NEXT_PUBLIC_`, never commit it, never paste it into a chat or an issue. |

---

## 2. Apply the migrations

**Option A — Supabase CLI (recommended):**

```bash
npm i -g supabase
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

**Option B — SQL editor:** paste each file from `supabase/migrations/` into the
Supabase SQL editor **in numeric order**, running one at a time.

Order matters: `0005` adds a foreign key that `0004` declares, and `0012`
asserts the posture that `0010`/`0011` establish.

Migration `0012` is a tripwire. It fails the deploy — deliberately — if:

- any table in `public` has RLS disabled,
- the `anon` role has gained a privilege on any base table,
- `anon` can execute any function,
- a price-shaped column has reached an anon-readable view,
- the `reservations` table has grown a price column.

A failure there is not a bug to work around. It means the security posture has
regressed and something needs fixing before it ships.

### Seed data

```bash
psql "$DATABASE_URL" -f supabase/seed.sql
```

Seed data is **fictional and clearly marked**: placeholder branches with `TODO`
addresses, development prices, and specs with `is_confirmed = false`. Replace
all of it before launch — see §6.

---

## 3. Create the first admin

Signing up grants nothing. A new `auth.users` row gets a profile with **no
roles**, and `getAdminSession()` refuses any account with an empty permission
set. Access is granted deliberately:

1. Supabase Dashboard → Authentication → Users → **Add user**. Set an email and
   a strong password, and tick *Auto Confirm User*.
2. Run in the SQL editor:

```sql
insert into public.user_roles (user_id, role_key)
select id, 'admin' from auth.users where email = 'you@almurshid.ly'
on conflict do nothing;
```

3. Sign in at `/admin/login`.

Add colleagues the same way with `'manager'` or `'staff'`:

| Role | Can do |
|---|---|
| `admin` | Everything, including granting roles. |
| `manager` | Everything except managing users. |
| `staff` | View and progress reservations, scan QR codes. **Cannot see prices.** |

Give counter staff `staff`. They can run the entire fulfilment workflow, and the
internal price is never sent to their browser — not hidden with CSS, not sent.

### Auth settings worth changing

- Authentication → Providers: **disable email sign-ups** once your team is in.
  There is no reason for the public to create accounts on this project.
- Authentication → URL Configuration: set the Site URL to your domain.

---

## 4. Vercel

1. Import the repository at [vercel.com](https://vercel.com).
2. Add the environment variables from `.env.example` (Production + Preview).
   Generate the two secrets:

```bash
openssl rand -hex 32   # IP_HASH_SALT
openssl rand -hex 32   # CRON_SECRET
```

3. Set `NEXT_PUBLIC_SITE_URL` to the real domain — SEO metadata, the sitemap and
   confirmation links all derive from it.
4. Deploy.

### Verify the build

```bash
npm install
npm run build      # must complete with zero TypeScript errors
npm run typecheck
```

---

## 5. Reservation expiry

Expired reservations must return their stock. Two ways; pick one.

**A — pg_cron (preferred).** Migration `0012` schedules it automatically where
the extension is available. Confirm:

```sql
select jobname, schedule from cron.job where jobname like 'al-murshid%';
```

**B — Vercel Cron.** If `pg_cron` is unavailable, add `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/expire", "schedule": "*/10 * * * *" }]
}
```

Vercel sends `Authorization: Bearer $CRON_SECRET`, which the route compares in
constant time. Running both is harmless — `expire_reservations()` uses
`FOR UPDATE SKIP LOCKED` and every restoration is guarded by `stock_released`,
so a unit can only ever come back once.

---

## 6. Before you take real reservations

Everything below is placeholder data. Replace it.

### In the admin Settings screen

- [ ] `booking_launch_at` — the real launch moment (stored UTC; enter the local
      time you want and check it renders correctly on the landing page)
- [ ] `reservation_expiry_hours` — currently 48
- [ ] `contact_phone`, `whatsapp_number`
- [ ] `social_instagram`, `social_facebook`, `social_tiktok`
- [ ] `trust_pickup_note_ar`, `trust_delivery_note_ar`, `trust_payment_note_ar` —
      **empty by default and the sections stay hidden until you fill them.**
      Write your real policy; do not let the platform invent one.
- [ ] `announcement_ar` — optional banner
- [ ] `store_name`, `primary_product_slug`, `compare_product_slugs`
- [ ] Leave `show_exact_stock` **off** unless you genuinely want customers to
      see unit counts.

### In SQL or the admin screens

- [ ] `branches` — real names, addresses, phones, opening hours. Delete or
      deactivate the two placeholders.
- [ ] `variant_pricing` — real internal prices. **A variant with no price cannot
      be reserved**; the RPC refuses rather than recording a reservation at zero.
- [ ] `devices_stock` — real quantities.
- [ ] `product_specs` — set `value_ar` and flip `is_confirmed = true` only for
      specifications that have been officially announced. Unconfirmed rows
      render as "يُعلن لاحقًا", which is the correct behaviour before a keynote.
- [ ] `products.is_placeholder` — set to `false` once the product is announced.

### Assets

- [ ] `public/images/products/*.png` — product photography. Until these exist,
      an original abstract device rendering is drawn instead; nothing breaks.
- [ ] `public/models/iphone.glb` — the 3D model. Until it exists, the 360°
      section shows the still image and says the viewer is coming.
- [ ] `public/images/og.png` — a branded social card is included; replace it if
      you have art direction.

### Optional

- [ ] Cloudflare Turnstile: set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and
      `TURNSTILE_SECRET_KEY` to switch on bot protection for the booking form.
      Leave blank to keep it off.

---

## 7. Production checklist

**Secrets**
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set only in Vercel env vars, has no
      `NEXT_PUBLIC_` prefix, and is not in git history
- [ ] `IP_HASH_SALT` and `CRON_SECRET` are 32+ random hex characters
- [ ] `.env.local` is not committed (it is in `.gitignore`)

**Database**
- [ ] All 13 migrations applied; `0012` passed
- [ ] Point-in-time recovery enabled (Supabase → Database → Backups)
- [ ] At least one `admin` user exists and can sign in

**Behaviour**
- [ ] `/` renders and shows **no prices anywhere** — check the page source too
- [ ] `/book` completes end to end and produces a code + QR
- [ ] `/track` finds that reservation with code + phone, and finds nothing with
      the wrong phone
- [ ] `/admin` redirects to login when signed out
- [ ] A `staff` account sees "محجوب" instead of a price on a reservation detail
- [ ] Scanning the same QR twice gives `تم استخدام رمز QR مسبقًا`
- [ ] `/api/health` returns `{"status":"ok"}`

**Search engines**
- [ ] `/robots.txt` disallows `/admin` and `/reservation/`
- [ ] `/sitemap.xml` lists only `/`, `/book`, `/track`

**Operations**
- [ ] Expiry job scheduled and observed to run once
- [ ] Uptime monitor pointed at `/api/health`
- [ ] The team knows where the emergency stop is: Settings →
      **إيقاف الحجوزات مؤقتًا**, which blocks new reservations at the database
      while tracking and the dashboard keep working

---

## 8. Operating notes

**Emergency stop.** Toggling `maintenance_mode` takes effect immediately and is
enforced in `create_reservation()` — not merely in the UI. Existing reservations
and `/track` are unaffected.

**Launch day.** Keep the Stock screen open. Row-lock contention is per-variant
and held for about a millisecond, so a queue on one popular colour does not slow
down any other SKU.

**Pricing changes.** Safe at any time. Reservations already created keep the
price snapshot taken inside their transaction; `reservation_pricing` is
immutable and a trigger blocks updates to it.

**Data retention.** Reservations are permanent by design — the stock ledger and
audit trail pin them with `ON DELETE RESTRICT`. What *can* be removed is the
personal data on a completed reservation: the detail screen offers
**إخفاء البيانات الشخصية** for terminal reservations, which clears name, phone
and city while leaving the commercial record intact.

**Restoring from backup.** Restore the whole database. Do not restore
`reservations` without `devices_stock` and `reservation_pricing` — they are
consistent only together.
