-- Table for caching AI-generated org summaries (risk assessments)
CREATE TABLE IF NOT EXISTS organization_summaries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  summary_type     TEXT NOT NULL DEFAULT 'risk_assessment',
  risk_level       TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  content          JSONB NOT NULL DEFAULT '{}',
  model_used       TEXT NOT NULL DEFAULT 'claude-3.5-sonnet',
  generated_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at       TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, summary_type)
);
CREATE INDEX IF NOT EXISTS idx_org_summaries_org ON organization_summaries(organization_id);

ALTER TABLE organization_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access" ON organization_summaries;
CREATE POLICY "Public read access" ON organization_summaries FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service write access" ON organization_summaries;
CREATE POLICY "Service write access" ON organization_summaries FOR ALL USING (auth.role() = 'service_role');
