#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Rebuild the Al-Murshid schema in a local PostgreSQL database and seed it.
#
#   ./scripts/db-local.sh [dbname]
#
# Applies the local Supabase shim, then every migration in order, then the seed.
# Used by the integration tests and for offline development.
# -----------------------------------------------------------------------------
set -euo pipefail

DB="${1:-almurshid_test}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL="psql -v ON_ERROR_STOP=1 -q"

echo "▸ recreating database: $DB"
dropdb --if-exists "$DB"
createdb "$DB"

echo "▸ applying local Supabase shim"
$PSQL -d "$DB" -f "$ROOT/supabase/tests/00_local_shim.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "▸ $(basename "$f")"
  $PSQL -d "$DB" -f "$f"
done

echo "▸ seed.sql"
$PSQL -d "$DB" -f "$ROOT/supabase/seed.sql"

echo "✓ $DB ready"
