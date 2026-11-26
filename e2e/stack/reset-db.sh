#!/usr/bin/env bash
# Recreates the local "majal" database and applies bootstrap + every migration in order.
set -euo pipefail
PSQL="psql -h ${PGHOST:-/tmp} -p ${PGPORT:-54322} -U postgres -v ON_ERROR_STOP=1 -q"
DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DBNAME="${DBNAME:-majal}"
$PSQL -d postgres -c "DROP DATABASE IF EXISTS $DBNAME WITH (FORCE)" -c "CREATE DATABASE $DBNAME"
$PSQL -d "$DBNAME" -f "$DIR/e2e/stack/bootstrap.sql"
# MIGRATIONS_DIR lets the probes build the schema as it was before the fixes.
for f in "${MIGRATIONS_DIR:-$DIR/supabase/migrations}"/*.sql; do
  echo "→ $(basename "$f")"
  $PSQL -d "$DBNAME" -f "$f"
done
echo "OK: all migrations applied"
