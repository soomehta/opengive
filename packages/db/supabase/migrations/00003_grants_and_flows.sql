-- =============================================================================
-- Migration: 00003_grants_and_flows.sql
-- Description: Create grants table — money-flow records between organizations.
-- Depends on: 00001_initial_schema.sql (organizations table)
-- Idempotent: Uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: grants
-- Tracks grant disbursements from a funder to a recipient.
-- funder_org_id / recipient_org_id are nullable to handle cases where one
-- party has not yet been resolved to an organizations row.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funder_org_id       UUID REFERENCES organizations(id),
  recipient_org_id    UUID REFERENCES organizations(id),
  recipient_name      TEXT,                       -- When recipient is not in our DB
  recipient_country   TEXT,

  amount      NUMERIC(15,2) NOT NULL,
  currency    TEXT DEFAULT 'USD',
  amount_usd  NUMERIC(15,2),                      -- Normalized to USD

  grant_date    DATE,
  fiscal_year   INTEGER,
  purpose       TEXT,
  program_area  TEXT,
  grant_type    TEXT,                             -- 'general_support', 'project', 'capital', 'endowment', etc.

  source     TEXT NOT NULL,                       -- 'irs_990_schedule_i', '360giving', 'iati', etc.
  source_id  TEXT,                                -- ID within the source dataset

  created_at  TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source, source_id)
);

-- Indexes matching the query patterns listed in the PRD
CREATE INDEX IF NOT EXISTS idx_grants_funder    ON grants(funder_org_id);
CREATE INDEX IF NOT EXISTS idx_grants_recipient ON grants(recipient_org_id);
CREATE INDEX IF NOT EXISTS idx_grants_year      ON grants(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_grants_amount    ON grants(amount_usd);
