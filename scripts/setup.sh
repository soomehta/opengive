#!/usr/bin/env bash
set -euo pipefail

echo "=== OpenGive Local Setup ==="

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Error: node is required"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "Error: pnpm is required. Install: npm i -g pnpm"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Error: docker is required"; exit 1; }

# Copy env if needed
if [ ! -f .env.local ]; then
  echo "Creating .env.local from .env.docker..."
  cp .env.docker .env.local 2>/dev/null || cp .env.example .env.local
  echo "Please edit .env.local with your credentials"
fi

# Install dependencies
echo "Installing pnpm dependencies..."
pnpm install

# Start docker stack
echo "Starting local Supabase stack..."
docker compose --env-file .env.local up -d

# Wait for DB to be ready
echo "Waiting for database..."
until docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done
echo "Database is ready!"

# Run migrations
echo "Running migrations..."
bash scripts/migrate.sh

# Seed data
echo "Seeding development data..."
docker compose exec -T db psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/../seed.sql 2>/dev/null || \
  echo "Seed file not found or already applied — skipping"

echo ""
echo "=== Setup Complete ==="
echo "Supabase Studio: http://localhost:54323"
echo "API Gateway:     http://localhost:54321"
echo "Next.js dev:     pnpm turbo dev --filter=web"
echo ""
