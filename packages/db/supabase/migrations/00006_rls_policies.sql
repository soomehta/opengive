-- =============================================================================
-- Migration: 00006_rls_policies.sql
-- Description: User profile tables (Supabase Auth integration) and Row Level
--              Security policies for all public and user-scoped tables.
-- Depends on: 00001 – 00004 migrations (all core tables must exist)
-- Idempotent: Uses CREATE TABLE IF NOT EXISTS, DO $$ guards for triggers,
--             and DROP POLICY IF EXISTS before each CREATE POLICY.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: user_profiles
-- One row per authenticated Supabase user; extends auth.users.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('viewer', 'analyst', 'admin')),
  preferences   JSONB DEFAULT '{}',
  api_key_hash  TEXT,                             -- For public API access (hashed)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_user_profiles_updated_at'
  ) THEN
    CREATE TRIGGER trg_user_profiles_updated_at
      BEFORE UPDATE ON user_profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Table: saved_investigations
-- Persists a user's exploration state (filters, selected orgs, notes).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_investigations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  query_state       JSONB NOT NULL,               -- Serialized investigation state
  organization_ids  UUID[],                       -- Organizations in this investigation
  is_public         BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_investigations_user_id
  ON saved_investigations(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_investigations_public
  ON saved_investigations(is_public) WHERE is_public = true;

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_saved_investigations_updated_at'
  ) THEN
    CREATE TRIGGER trg_saved_investigations_updated_at
      BEFORE UPDATE ON saved_investigations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$;

-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Enable RLS on all tables that need access control
-- (ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent — safe to re-run)
-- ---------------------------------------------------------------------------
ALTER TABLE organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_filings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE grants                ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_alerts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_investigations   ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Public read policies
-- Charity data is public information — anyone (including unauthenticated
-- visitors) may SELECT from these tables.
-- ---------------------------------------------------------------------------

-- organizations
DROP POLICY IF EXISTS "Public read access" ON organizations;
CREATE POLICY "Public read access"
  ON organizations FOR SELECT
  USING (true);

-- financial_filings
DROP POLICY IF EXISTS "Public read access" ON financial_filings;
CREATE POLICY "Public read access"
  ON financial_filings FOR SELECT
  USING (true);

-- grants
DROP POLICY IF EXISTS "Public read access" ON grants;
CREATE POLICY "Public read access"
  ON grants FOR SELECT
  USING (true);

-- anomaly_alerts
DROP POLICY IF EXISTS "Public read access" ON anomaly_alerts;
CREATE POLICY "Public read access"
  ON anomaly_alerts FOR SELECT
  USING (true);

-- ---------------------------------------------------------------------------
-- Service role write policies
-- Only the backend service role (pipeline / ML API) may INSERT / UPDATE /
-- DELETE public charity data.  The service_role key bypasses RLS by default
-- in Supabase, but explicit policies guard against misconfiguration.
-- ---------------------------------------------------------------------------

-- organizations
DROP POLICY IF EXISTS "Service write access" ON organizations;
CREATE POLICY "Service write access"
  ON organizations FOR ALL
  USING (auth.role() = 'service_role');

-- financial_filings
DROP POLICY IF EXISTS "Service write access" ON financial_filings;
CREATE POLICY "Service write access"
  ON financial_filings FOR ALL
  USING (auth.role() = 'service_role');

-- grants
DROP POLICY IF EXISTS "Service write access" ON grants;
CREATE POLICY "Service write access"
  ON grants FOR ALL
  USING (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- User-scoped policies
-- Each authenticated user may only access their own profile and
-- investigations.  Public investigations are additionally readable by anyone.
-- ---------------------------------------------------------------------------

-- user_profiles: each user owns their own row
DROP POLICY IF EXISTS "Users own profiles" ON user_profiles;
CREATE POLICY "Users own profiles"
  ON user_profiles FOR ALL
  USING (auth.uid() = id);

-- saved_investigations: owner has full access
DROP POLICY IF EXISTS "Users own investigations" ON saved_investigations;
CREATE POLICY "Users own investigations"
  ON saved_investigations FOR ALL
  USING (auth.uid() = user_id);

-- saved_investigations: public ones are readable by all
DROP POLICY IF EXISTS "Public investigations readable" ON saved_investigations;
CREATE POLICY "Public investigations readable"
  ON saved_investigations FOR SELECT
  USING (is_public = true);
