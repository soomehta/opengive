-- =============================================================================
-- Migration: 00002_financial_tables.sql
-- Description: Create financial_filings table — annual financial data per org.
-- Depends on: 00001_initial_schema.sql (organizations table + trigger function)
-- Idempotent: Uses CREATE TABLE IF NOT EXISTS and DO $$ guards.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: financial_filings
-- One row per (organization, fiscal_year, filing_type).
-- Revenue, expenses, balance-sheet columns are all nullable to accommodate
-- partial filings from registries that don't expose every line item.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financial_filings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Period
  fiscal_year   INTEGER NOT NULL,
  period_start  DATE,
  period_end    DATE,
  filing_type   TEXT,                             -- '990', '990-EZ', '990-PF', 'annual_return', etc.

  -- Revenue
  total_revenue               NUMERIC(15,2),
  contributions_grants        NUMERIC(15,2),
  program_service_revenue     NUMERIC(15,2),
  investment_income           NUMERIC(15,2),
  other_revenue               NUMERIC(15,2),

  -- Expenses
  total_expenses          NUMERIC(15,2),
  program_expenses        NUMERIC(15,2),
  admin_expenses          NUMERIC(15,2),
  fundraising_expenses    NUMERIC(15,2),

  -- Balance sheet
  total_assets        NUMERIC(15,2),
  total_liabilities   NUMERIC(15,2),
  net_assets          NUMERIC(15,2),

  -- Computed ratios (denormalized for query performance)
  program_expense_ratio   REAL,                  -- program_expenses / total_expenses
  admin_expense_ratio     REAL,
  fundraising_efficiency  REAL,                  -- fundraising_expenses / contributions_grants
  working_capital_ratio   REAL,

  -- Currency and source
  currency            TEXT DEFAULT 'USD',
  currency_original   TEXT,                      -- Original filing currency
  exchange_rate       REAL,                      -- Rate used for conversion
  source_url          TEXT,                      -- Link to original filing
  raw_filing_key      TEXT,                      -- Supabase Storage key for raw filing

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, fiscal_year, filing_type)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_financials_org_id     ON financial_filings(organization_id);
CREATE INDEX IF NOT EXISTS idx_financials_year       ON financial_filings(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_financials_filing_type ON financial_filings(filing_type);

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_financial_filings_updated_at'
  ) THEN
    CREATE TRIGGER trg_financial_filings_updated_at
      BEFORE UPDATE ON financial_filings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$;
