#!/usr/bin/env bash
set -euo pipefail

echo "=== Supabase Project Setup ==="

# Check prerequisites
command -v supabase >/dev/null 2>&1 || { echo "Error: supabase CLI required. Install: npm i -g supabase"; exit 1; }

# Initialize if not already done
if [ ! -f "packages/db/supabase/config.toml" ]; then
  echo "Initializing Supabase project..."
  cd packages/db
  supabase init
  cd ../..
fi

# Link to remote project (requires SUPABASE_PROJECT_REF env var)
if [ -n "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "Linking to Supabase project: $SUPABASE_PROJECT_REF"
  cd packages/db
  supabase link --project-ref "$SUPABASE_PROJECT_REF"
  cd ../..
fi

# Push migrations
echo "Pushing migrations..."
cd packages/db
supabase db push
cd ../..

# Set up storage buckets
echo "Setting up storage buckets..."
# These would be created via Supabase dashboard or management API
echo "  - raw-filings (for original filing documents)"
echo "  - parsed-data (for intermediate parsed data)"
echo "  - org-logos (for organization logos)"
echo "Note: Create these buckets in the Supabase dashboard"

echo ""
echo "=== Supabase Setup Complete ==="
