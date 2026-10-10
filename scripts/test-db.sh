#!/usr/bin/env bash
#
# Applies every migration to a throwaway PostgreSQL instance and runs the Row
# Level Security and constraint tests against it.
#
# This needs only a local `postgres` install (no Docker and no Supabase
# project): the auth and storage pieces the migrations depend on are emulated
# by supabase/tests/00_local_supabase_shim.sql, which is never applied to a
# real project.
#
# Usage: ./scripts/test-db.sh
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# A short path: a Unix socket path is limited to about 100 characters.
WORKDIR="$(mktemp -d /tmp/foodlens-db.XXXXXX)"
PGDATA="$WORKDIR/pgdata"
PGPORT="${PGPORT:-59432}"
DB_NAME="foodlens_test"

# initdb refuses to run under some locale settings, so pin a portable one.
export LANG=C
export LC_ALL=C

cleanup() {
  pg_ctl -D "$PGDATA" -m immediate stop > /dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

echo "==> Initializing a temporary PostgreSQL cluster"
initdb -D "$PGDATA" -U postgres --auth=trust --locale=C --encoding=UTF8 \
  > "$WORKDIR/initdb.log" 2>&1

echo "==> Starting PostgreSQL on port $PGPORT"
pg_ctl -D "$PGDATA" \
  -o "-k $WORKDIR -p $PGPORT -c listen_addresses=''" \
  -l "$WORKDIR/postgres.log" start > /dev/null

psql() { command psql -h "$WORKDIR" -p "$PGPORT" -U postgres "$@"; }

psql -tAc "create database $DB_NAME;" > /dev/null

echo "==> Applying the local Supabase shim (test harness only)"
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -q \
  -f "$PROJECT_ROOT/supabase/tests/00_local_supabase_shim.sql"

echo "==> Applying migrations"
for migration in "$PROJECT_ROOT"/supabase/migrations/*.sql; do
  echo "    $(basename "$migration")"
  psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -q -f "$migration"
done

echo "==> Running RLS and constraint tests"
# The prefix is stripped up to the `file.sql:LINE:` marker rather than to the
# first space, because a project path may itself contain spaces.
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$PROJECT_ROOT/supabase/tests/10_rls_tests.sql" \
  2>&1 \
  | sed -E 's/^psql:.*\.sql:[0-9]+: //; s/^NOTICE:  //' \
  | grep -E '^(ok -|FAILED|ERROR|ALL RLS)' \
  || { echo "No test output: the suite did not run."; exit 1; }

echo "==> Done"
