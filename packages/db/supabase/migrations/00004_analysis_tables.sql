-- =============================================================================
-- Migration: 00004_analysis_tables.sql
-- Description: Create AI/ML analysis tables — anomaly_alerts,
--              organization_scores, entity_matches, and scrape_runs.
-- Depends on: 00001_initial_schema.sql (organizations table)
-- Idempotent: Uses CREATE TABLE IF NOT EXISTS and DO $$ guards.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: anomaly_alerts
-- Stores alerts raised by the ML analysis engine for a given org/year.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS anomaly_alerts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  fiscal_year      INTEGER,

  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'overhead_manipulation',
    'related_party',
    'compensation_outlier',
    'revenue_expense_mismatch',
    'benford_violation',
    'network_anomaly',
    'filing_inconsistency',
    'geographic_discrepancy',
    'zero_fundraising',
    'rapid_growth',
    'shell_indicator',
    'other'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),

  title        TEXT NOT NULL,
  description  TEXT NOT NULL,                     -- Plain-language explanation
  evidence     JSONB NOT NULL DEFAULT '{}',        -- Structured evidence data
  methodology  TEXT NOT NULL,                     -- Which algorithm generated this

  is_reviewed   BOOLEAN DEFAULT false,
  reviewed_by   UUID,
  review_notes  TEXT,

  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_org_id     ON anomaly_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_severity   ON anomaly_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_anomaly_alert_type ON anomaly_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_anomaly_year       ON anomaly_alerts(fiscal_year);

-- ---------------------------------------------------------------------------
-- Table: organization_scores
-- Composite and component scores per (org, year, methodology version).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_scores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  fiscal_year      INTEGER NOT NULL,

  -- Composite scores (0-100)
  overall_score           REAL,
  financial_health_score  REAL,
  transparency_score      REAL,
  governance_score        REAL,
  efficiency_score        REAL,

  -- Score breakdown (JSONB for flexibility as methodology evolves)
  score_breakdown       JSONB NOT NULL DEFAULT '{}',
  methodology_version   TEXT NOT NULL DEFAULT 'v1',

  created_at  TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, fiscal_year, methodology_version)
);

CREATE INDEX IF NOT EXISTS idx_scores_org_id ON organization_scores(organization_id);
CREATE INDEX IF NOT EXISTS idx_scores_year   ON organization_scores(fiscal_year);

-- ---------------------------------------------------------------------------
-- Table: entity_matches
-- Cross-registry deduplication output from the Splink entity resolution
-- pipeline. Stores pairwise match probabilities.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entity_matches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_a_id            UUID REFERENCES organizations(id),
  org_b_id            UUID REFERENCES organizations(id),
  match_probability   REAL NOT NULL,              -- Splink probability (0-1)
  match_type          TEXT,                       -- 'confirmed', 'probable', 'possible'
  matched_fields      TEXT[],                     -- Which fields contributed to the match
  reviewed            BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_a_id, org_b_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_matches_org_a ON entity_matches(org_a_id);
CREATE INDEX IF NOT EXISTS idx_entity_matches_org_b ON entity_matches(org_b_id);

-- ---------------------------------------------------------------------------
-- Table: scrape_runs
-- Provenance log for every pipeline execution — one row per spider run.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrape_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source        TEXT NOT NULL,
  spider_name   TEXT,
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  status TEXT DEFAULT 'running' CHECK (status IN (
    'running', 'completed', 'failed', 'cancelled'
  )),
  records_found    INTEGER DEFAULT 0,
  records_new      INTEGER DEFAULT 0,
  records_updated  INTEGER DEFAULT 0,
  records_failed   INTEGER DEFAULT 0,
  error_log        TEXT,
  metadata         JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_scrape_runs_source ON scrape_runs(source);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_status ON scrape_runs(status);
