#!/usr/bin/env bash
# Rebuild the local schema, then run the full SQL test suite.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${1:-almurshid_test}"

"$ROOT/scripts/db-local.sh" "$DB" >/dev/null
echo "▸ behaviour & security suite"
psql -d "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/tests/sql/behaviour.sql" 2>&1 \
  | sed -n 's/^psql:.*NOTICE:  //p; /^━━/p; /^═══/p; /PASSED/p'
echo ""
echo "▸ concurrency suite"
"$ROOT/tests/sql/concurrency.sh" "$DB" 25 | tail -9
