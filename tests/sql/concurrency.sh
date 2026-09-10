#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# The test that matters most: N customers, 1 unit of stock, simultaneous submit.
#
# Passing criterion: exactly ONE reservation is created, stock lands on 0, and
# every loser receives OUT_OF_STOCK. Run against a real PostgreSQL server.
#
#   ./tests/sql/concurrency.sh [dbname] [parallel_attempts]
# -----------------------------------------------------------------------------
set -uo pipefail

DB="${1:-almurshid_test}"
N="${2:-12}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

q() { psql -d "$DB" -v ON_ERROR_STOP=1 -tA -c "$1"; }

echo "── setup ─────────────────────────────────────────────"
# Open the booking window (the seed deliberately ships it closed).
q "update app_settings set value = to_jsonb((now() - interval '1 hour')::text) where key = 'booking_launch_at';" >/dev/null

# Reservations are permanent by design (the ledger pins them with ON DELETE
# RESTRICT), so each run tags its own rows instead of deleting the previous run's.
MARK="Concurrency-$(date +%s%N)"

VARIANT=$(q "select v.id from product_variants v
             join products p on p.id = v.product_id
             join capacities c on c.id = v.capacity_id
             join colors col on col.id = v.color_id
             where p.slug = 'iphone-18-pro-max' and c.key = '512GB' and col.key = 'burgundy';")

BRANCH=$(q "select id from branches where slug = 'tripoli-main';")

q "update devices_stock set quantity = 1, reserved_quantity = 0 where variant_id = '$VARIANT';" >/dev/null

BEFORE=$(q "select quantity from devices_stock where variant_id = '$VARIANT';")
echo "variant  : $VARIANT"
echo "stock    : $BEFORE unit"
echo "attempts : $N concurrent"

echo "── firing ────────────────────────────────────────────"
for i in $(seq 1 "$N"); do
  (
    PHONE=$(printf "091%07d" "$i")
    psql -d "$DB" -tA -c "
      select create_reservation(
        p_variant_id        => '$VARIANT'::uuid,
        p_customer_name     => '$MARK customer $i',
        p_customer_phone    => '$PHONE',
        p_customer_city     => 'طرابلس',
        p_delivery_method   => 'PICKUP'::delivery_method,
        p_access_token_hash => sha256_hex('token-$i-' || random()::text),
        p_branch_id         => '$BRANCH'::uuid
      );" >"$TMP/out.$i" 2>"$TMP/err.$i"
    echo $? >"$TMP/code.$i"
  ) &
done
wait

OK=0; FAIL=0; OTHER=0
for i in $(seq 1 "$N"); do
  if [ "$(cat "$TMP/code.$i")" = "0" ]; then
    OK=$((OK+1))
  elif grep -q "OUT_OF_STOCK" "$TMP/err.$i"; then
    FAIL=$((FAIL+1))
  else
    OTHER=$((OTHER+1))
    echo "  unexpected error: $(head -2 "$TMP/err.$i" | tr '\n' ' ')"
  fi
done

AFTER=$(q "select quantity from devices_stock where variant_id = '$VARIANT';")
RESERVED=$(q "select reserved_quantity from devices_stock where variant_id = '$VARIANT';")
CREATED=$(q "select count(*) from reservations where customer_name like '$MARK%';")
NEGATIVE=$(q "select count(*) from devices_stock where quantity < 0;")

echo "── results ───────────────────────────────────────────"
printf "  succeeded        : %s\n" "$OK"
printf "  OUT_OF_STOCK     : %s\n" "$FAIL"
printf "  other errors     : %s\n" "$OTHER"
printf "  reservations     : %s\n" "$CREATED"
printf "  stock after      : %s (reserved %s)\n" "$AFTER" "$RESERVED"
printf "  negative rows    : %s\n" "$NEGATIVE"

STATUS=0
[ "$OK"       = "1" ] || { echo "✗ expected exactly 1 success, got $OK"; STATUS=1; }
[ "$CREATED"  = "1" ] || { echo "✗ expected exactly 1 reservation, got $CREATED"; STATUS=1; }
[ "$AFTER"    = "0" ] || { echo "✗ expected stock 0, got $AFTER"; STATUS=1; }
[ "$RESERVED" = "1" ] || { echo "✗ expected reserved 1, got $RESERVED"; STATUS=1; }
[ "$NEGATIVE" = "0" ] || { echo "✗ negative stock detected"; STATUS=1; }
[ "$OTHER"    = "0" ] || { echo "✗ unexpected error class"; STATUS=1; }

[ "$STATUS" = "0" ] && echo "✓ PASS — exactly one winner, stock exact, nothing negative"
exit $STATUS
