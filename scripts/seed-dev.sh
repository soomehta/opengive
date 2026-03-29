#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-54322}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"

SEED_FILE="packages/db/supabase/seed.sql"

if [ ! -f "$SEED_FILE" ]; then
  echo "Error: seed file not found at $SEED_FILE"
  exit 1
fi

echo "Seeding database from $SEED_FILE..."
PGPASSWORD=postgres psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SEED_FILE"
echo "Seeding complete."
