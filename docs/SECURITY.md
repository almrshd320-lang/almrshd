# Security review

Threat model and the audit performed against it. Each item states what was
checked, and what would actually happen if someone tried it.

---

## Trust model in one paragraph

The browser holds the `anon` key, which can read five views and nothing else —
no base table, no function. Customers have no Supabase identity at all; every
customer write is a Server Action that validates, rate-limits and then calls a
`SECURITY DEFINER` RPC granted only to `service_role`. Staff sign in with
Supabase Auth and act as themselves, so RLS applies and the audit trail names a
person. The service-role key exists only in the Next.js server runtime, behind
an `import 'server-only'` guard that makes reaching it from a Client Component
a build error.

---

## 1. Price leakage — the headline requirement

**Checked:** every path a price could take to a browser.

| Path | Result |
|---|---|
| `select *` on `product_variants` | No price column exists — prices are in `variant_pricing`. |
| `select *` on `reservations` | No price column exists — the snapshot is in `reservation_pricing`. |
| Any public view | `v_public_variants` does not join the pricing tables. Migration `0012` fails the deploy if a `price`/`cost`/`lyd` column ever appears on an anon-readable view. |
| PostgREST with the anon key | `anon` has **no privilege** on `variant_pricing`, `reservation_pricing` or `price_history`. Not policy-denied — no grant at all. |
| Customer RPCs | `reservation_public_payload()` lists its columns by hand and never joins pricing. Asserted by a test that greps the payload for "price". |
| Page source / RSC payload | No customer-facing TypeScript type carries a price field, so no component can render one. |
| Admin API as a low-privilege user | `admin_reservation_detail()` returns `price_at_reservation: null` unless `has_permission('view_prices')`. The number is never sent, so it cannot be revealed by editing the DOM. |
| CSV export | Includes the price column only when the caller holds `view_prices` as well as `export_data`. |
| Print slip | Same rule; the value is already null in the payload. |

**Verified by:** `tests/sql/behaviour.sql` §2, §13, §14; `tests/integration`
"never returns a price in the customer payload", "exposes no price-shaped column
on any anon-readable view".

---

## 2. Race conditions and negative inventory

**Attack:** two customers submit for the last unit in the same millisecond.

**Defence:** `create_reservation()` takes `SELECT … FOR UPDATE` on the stock
row. The second session blocks, then re-reads `quantity` *inside* the lock and
raises `OUT_OF_STOCK`. `CHECK (quantity >= 0)` is the backstop if the logic is
ever wrong.

**Verified:** 25 concurrent attempts against 1 unit → exactly 1 reservation,
`quantity = 0`, `reserved_quantity = 1`, zero negative rows.
(`tests/sql/concurrency.sh`, and again in vitest.)

**Related — double restoration.** A cancel racing an expiry, or a retried cron
run, could return the same unit twice. Guarded by `reservations.stock_released`,
flipped inside the same locked transaction that restores the unit. Tested with
three concurrent release calls: stock increases by exactly one.

---

## 3. Reservation enumeration

**Attack:** iterate reservation codes to harvest customer data.

**Defences:**
- Codes are 6 symbols from a 32-character alphabet — 32⁶ ≈ 1.07e9 — generated
  from `gen_random_bytes`, not sequential ids.
- `/track` requires code **and** phone number.
- A valid code with the wrong phone and an unknown code return the *same*
  message through the *same* code path — no oracle.
- Rate limited to 10 lookups per IP per 10 minutes.
- Even a successful lookup returns a masked name (`م••••`), no address, no
  price, and no internal id.

**Verified:** `behaviour.sql` §8; integration "finds a reservation by code +
phone, and nothing by code alone".

---

## 4. IDOR

**Checked:** `/reservation/[code]`, `/track`, `/admin/reservations/[id]`,
the print route, the export route.

- `/reservation/[code]` needs the raw access token, matched against a stored
  SHA-256. The code alone is not sufficient.
- Admin routes validate the UUID shape, then `requirePermission()`, then RLS.
- The print route re-checks the session and the permission independently of the
  page that links to it.
- Customers cannot read reservations through PostgREST at all: no grant.

---

## 5. QR forgery and reuse

- The payload is `MRSH1:<code>:<token>`. The token is 32 random bytes; only its
  SHA-256 is stored, so a database dump yields no working codes.
- Validation is server-side only, under `FOR UPDATE`. Code and token are matched
  in one predicate, so a valid code with a wrong token is indistinguishable from
  an unknown code.
- Single use: `qr_used_at` is stamped inside the lock; the second scan returns
  `ALREADY_USED`.
- Only `CONFIRMED`/`READY`/`OUT_FOR_DELIVERY` reservations are collectable.
- **Every attempt is recorded** in `qr_scans`, including failures, so brute
  force is visible rather than silent.
- The QR contains no name, phone, city or price.

**Verified:** `behaviour.sql` §7.

---

## 6. Broken access control

- Middleware redirects anonymous `/admin` traffic — a convenience, not the
  boundary.
- Every page calls `requireAdmin()` / `requirePermission()`.
- Every action calls `assertPermission()`.
- Every RPC calls `require_permission()` in SQL.
- Every table has RLS with no `USING (true)` policy anywhere.

Four independent layers. Bypassing the first three still leaves the database
refusing.

**Deactivation is immediate:** a JWT stays valid until it expires, so
`getAdminSession()` checks `profiles.is_active` on every request and refuses a
disabled account regardless of its token.

**Verified:** `behaviour.sql` §14 — a `staff` account is refused by
`admin_set_price` and receives no price in the detail payload.

---

## 7. Service-role key exposure

- Read through one accessor in `lib/supabase/service.ts`, which opens with
  `import 'server-only'` — importing it from a Client Component fails the build.
- Never given a `NEXT_PUBLIC_` prefix.
- The module refuses to start if the service-role key and the anon key are
  equal, which catches the specific misconfiguration that would be catastrophic.
- `.env.local` is gitignored; `.env.example` contains only placeholders.

---

## 8. Injection

- **SQL:** every database call is a parameterised RPC or a PostgREST builder
  call. No string-concatenated SQL anywhere. Admin search escapes `%`, `,`, `(`
  and `)` before building a PostgREST `or` filter.
- **XSS:** React escapes by default. The two `dangerouslySetInnerHTML` uses are
  `JSON.stringify` of structured data for JSON-LD, not user input. The print
  route is hand-built HTML and escapes every interpolated value.
- **Name field:** restricted to Arabic/Latin letters, spaces, apostrophes and
  hyphens — no digits, no angle brackets. `<script>alert(1)</script>` is
  rejected at validation, not merely escaped at render.
- **CSV injection:** cells beginning `=`, `+`, `-` or `@` are prefixed with an
  apostrophe so Excel does not execute a customer's name as a formula.
- **Open redirect:** `/admin/login?next=` accepts only a same-site absolute path
  and rejects protocol-relative `//evil.com`.

---

## 9. Rate limiting

Counters live in Postgres, because Vercel functions are stateless and an
in-memory counter would reset constantly and differ per region.

| Bucket | Limit | Key |
|---|---|---|
| `reservation_create` | 5 / 10 min | IP hash |
| `reservation_create_phone` | 2 / hour | phone hash |
| `track_lookup` | 10 / 10 min | IP hash |
| `qr_validate` | 120 / min | admin user |
| `admin_login` | 5 / 15 min | IP hash |

Identifiers are salted SHA-256 — **no raw IP is ever stored**. The limiter fails
*open* on a database error, deliberately: the RPCs behind it still validate
everything and stock is protected by the row lock, so a limiter outage should
not take the shop down.

---

## 10. Data minimisation and privacy

- Collected: name, phone, city, and a branch or delivery city. Nothing else.
  No address, no email, no date of birth, no payment details.
- Analytics record funnel steps and product choices only, through an allow-list
  of property names. No IP, no user agent, no cookie, no third-party script.
- Notification logs store a masked phone (`218•••••5678`), never the full number.
- Reservations cannot be deleted (history pins them), but personal data on a
  terminal reservation can be cleared with `admin_anonymize_reservation()`,
  keeping the commercial record intact.

---

## 11. Audit integrity

- `admin_audit_logs`, `price_history`, `stock_history`,
  `reservation_status_history`, `qr_scans` and `reservation_pricing` all reject
  `UPDATE` and `DELETE` via trigger, and no policy grants either to anyone.
- **Actor identity is denormalised with no foreign key.** Deleting a staff
  account cannot erase, blank or cascade away what that account did. This was a
  bug found during testing: the original schema used `ON DELETE SET NULL`, which
  the append-only trigger would have refused — leaving profile deletion broken
  and the intent unclear. History now pins its parents with `ON DELETE RESTRICT`.

---

## 12. Availability

- 3D never blocks the page: `ssr: false`, `IntersectionObserver`, explicit tap
  to load, WebGL capability check, error boundary. A missing `.glb` degrades to
  the still image.
- A missing product image falls back to an original abstract rendering.
- Settings and catalog reads fail soft with defaults rather than throwing.
- Analytics failures are swallowed — a reservation never fails because a
  tracking insert did.
- Error boundaries at route and root level; raw database messages never reach a
  customer's screen.

---

## Residual risks

| Risk | Status |
|---|---|
| No CAPTCHA by default | Hook point exists (`lib/security/captcha.ts`); set the Turnstile keys to enable. Rate limits apply meanwhile. |
| No SMS/WhatsApp verification of phone numbers | A wrong number is a business problem, not a security one; the outbox architecture is in place for when a provider is chosen. |
| Fixed-window rate limiting | Permits a burst at a window boundary. Adequate for this traffic profile; a sliding window is the upgrade if abuse appears. |
| Supabase Auth password policy | Configured in the Supabase dashboard, not in this codebase. Set a strong minimum. |
| `BarcodeDetector` unavailable in Safari | Manual entry and USB scanners cover it; adding a JS decoder library is the upgrade path. |
| Admin session length | Governed by Supabase JWT expiry. Shorten it in the dashboard for shared counter devices. |
