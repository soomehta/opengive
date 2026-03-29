-- =============================================================================
-- Migration: 00001_initial_schema.sql
-- Description: Enable extensions, create organizations, people, and
--              organization_people tables with all indexes and triggers.
-- Idempotent: All statements use IF NOT EXISTS guards.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";       -- pgvector: semantic search
CREATE EXTENSION IF NOT EXISTS "postgis";      -- geospatial queries
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- fuzzy text search
CREATE EXTENSION IF NOT EXISTS "pg_cron";      -- scheduled jobs

-- ---------------------------------------------------------------------------
-- Shared trigger function: auto-update updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Table: organizations
-- Central entity — one row per registered charity / NGO / foundation.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name            TEXT NOT NULL,
  name_local      TEXT,                             -- Name in local language/script
  slug            TEXT UNIQUE NOT NULL,             -- URL-friendly identifier
  aliases         TEXT[] DEFAULT '{}',              -- Alternative names

  -- Classification
  org_type TEXT NOT NULL CHECK (org_type IN (
    'charity', 'foundation', 'ngo', 'nonprofit', 'association',
    'trust', 'cooperative', 'social_enterprise', 'religious', 'other'
  )),
  sector          TEXT,                             -- NTEE or ICNPO classification
  subsector       TEXT,
  mission         TEXT,                             -- Mission statement
  description     TEXT,

  -- Registration
  country_code        TEXT NOT NULL,                -- ISO 3166-1 alpha-2
  jurisdiction        TEXT,                         -- State/province/region
  registry_source     TEXT NOT NULL,                -- e.g. 'us_irs', 'uk_charity_commission'
  registry_id         TEXT NOT NULL,                -- ID within source registry (EIN, charity number, etc.)
  registration_date   DATE,
  dissolution_date    DATE,
  status TEXT DEFAULT 'active' CHECK (status IN (
    'active', 'inactive', 'dissolved', 'suspended', 'unknown'
  )),

  -- Contact & location
  website         TEXT,
  email           TEXT,
  phone           TEXT,
  address_line1   TEXT,
  address_line2   TEXT,
  city            TEXT,
  state_province  TEXT,
  postal_code     TEXT,
  location        GEOGRAPHY(POINT, 4326),           -- PostGIS point for mapping

  -- Metadata
  logo_url            TEXT,
  last_filing_date    DATE,
  data_completeness   REAL DEFAULT 0,               -- 0-1 score of data completeness
  embedding           VECTOR(1536),                 -- For semantic search

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(registry_source, registry_id)
);

-- Standard B-tree indexes
CREATE INDEX IF NOT EXISTS idx_org_country   ON organizations(country_code);
CREATE INDEX IF NOT EXISTS idx_org_status    ON organizations(status);
CREATE INDEX IF NOT EXISTS idx_org_slug      ON organizations(slug);

-- Trigram index for fuzzy name search
CREATE INDEX IF NOT EXISTS idx_org_name_trgm ON organizations USING gin(name gin_trgm_ops);

-- PostGIS spatial index
CREATE INDEX IF NOT EXISTS idx_org_location  ON organizations USING gist(location);

-- pgvector approximate nearest-neighbour index (cosine similarity)
CREATE INDEX IF NOT EXISTS idx_org_embedding ON organizations
  USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);

-- Full-text search vector (GENERATED ALWAYS AS ... STORED)
-- Guard: only add the column if it does not already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE organizations ADD COLUMN search_vector TSVECTOR
      GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(mission, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'C')
      ) STORED;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_org_search ON organizations USING gin(search_vector);

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_organizations_updated_at'
  ) THEN
    CREATE TRIGGER trg_organizations_updated_at
      BEFORE UPDATE ON organizations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Table: people
-- Directors, trustees, officers — resolved across filings via Splink.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS people (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  name_normalized     TEXT NOT NULL,              -- Lowercased, stripped of honorifics
  entity_cluster_id   UUID,                       -- Links resolved duplicates (Splink output)
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_people_updated_at'
  ) THEN
    CREATE TRIGGER trg_people_updated_at
      BEFORE UPDATE ON people
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Table: organization_people
-- Many-to-many between organizations and people; captures role history.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_people (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  person_id        UUID REFERENCES people(id) ON DELETE CASCADE,
  role             TEXT NOT NULL,                 -- 'director', 'trustee', 'officer', 'ceo', 'cfo', etc.
  title            TEXT,                          -- Exact reported title
  compensation     NUMERIC(15,2),
  currency         TEXT DEFAULT 'USD',
  start_date       DATE,
  end_date         DATE,
  is_current       BOOLEAN DEFAULT true,
  filing_year      INTEGER,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_people_org_id    ON organization_people(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_people_person_id ON organization_people(person_id);
