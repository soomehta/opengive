-- Migration 00007: Enable RLS on all remaining tables
-- Fixes CRITICAL finding: 5 tables had no RLS policies

-- Enable RLS
ALTER TABLE IF EXISTS people ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS organization_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS organization_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS entity_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scrape_runs ENABLE ROW LEVEL SECURITY;

-- Enable on embeddings table if it exists (created in migration 00005)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'embeddings') THEN
    EXECUTE 'ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- Public read for publicly-relevant tables
DROP POLICY IF EXISTS "Public read access" ON people;
CREATE POLICY "Public read access" ON people FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access" ON organization_people;
CREATE POLICY "Public read access" ON organization_people FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access" ON organization_scores;
CREATE POLICY "Public read access" ON organization_scores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access" ON entity_matches;
CREATE POLICY "Public read access" ON entity_matches FOR SELECT USING (true);

-- Service role write for publicly-relevant tables
DROP POLICY IF EXISTS "Service write access" ON people;
CREATE POLICY "Service write access" ON people FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service write access" ON organization_people;
CREATE POLICY "Service write access" ON organization_people FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service write access" ON organization_scores;
CREATE POLICY "Service write access" ON organization_scores FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service write access" ON entity_matches;
CREATE POLICY "Service write access" ON entity_matches FOR ALL USING (auth.role() = 'service_role');

-- Restrict scrape_runs to service_role only (internal pipeline data)
DROP POLICY IF EXISTS "Service only" ON scrape_runs;
CREATE POLICY "Service only" ON scrape_runs FOR ALL USING (auth.role() = 'service_role');

-- Restrict embeddings to service_role only
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'embeddings') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Service only" ON embeddings';
    EXECUTE 'CREATE POLICY "Service only" ON embeddings FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
END $$;

-- Fix FINDING 13: Add missing write policy on anomaly_alerts
DROP POLICY IF EXISTS "Service write access" ON anomaly_alerts;
CREATE POLICY "Service write access" ON anomaly_alerts FOR ALL USING (auth.role() = 'service_role');
