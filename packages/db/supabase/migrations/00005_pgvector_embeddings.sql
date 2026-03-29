-- =============================================================================
-- Migration: 00005_pgvector_embeddings.sql
-- Description: Additional pgvector configuration and embedding-related
--              infrastructure beyond the ivfflat index created in migration
--              00001 on organizations.embedding.
--
--              The organizations.embedding column (VECTOR(1536)) and its
--              ivfflat index (idx_org_embedding) were created in migration
--              00001_initial_schema.sql.
--
--              This migration adds:
--              - A dedicated embeddings table for storing versioned embedding
--                snapshots of any entity (organization, filing, grant) so that
--                re-indexing after model upgrades does not require modifying
--                the source tables.
--              - A GUC hint to set ivfflat probes at session level (documented
--                here for operator reference; applied at query time via SET).
--
-- Depends on: 00001_initial_schema.sql
-- Idempotent: Uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.
-- =============================================================================

-- Ensure the vector extension is present (may already be enabled; IF NOT EXISTS
-- makes this safe to re-run).
CREATE EXTENSION IF NOT EXISTS "vector";

-- ---------------------------------------------------------------------------
-- Table: embeddings
-- Stores versioned embedding vectors for arbitrary entities.
-- Allows the ML service to refresh embeddings independently of the source
-- table without requiring a schema migration each time the model changes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS embeddings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which entity this embedding belongs to
  entity_type   TEXT NOT NULL,                    -- 'organization', 'filing', 'grant', etc.
  entity_id     UUID NOT NULL,

  -- Embedding data
  model_name    TEXT NOT NULL,                    -- e.g. 'text-embedding-3-small'
  model_version TEXT NOT NULL DEFAULT 'v1',
  dimensions    INTEGER NOT NULL,                 -- Snapshot of VECTOR size at creation time
  embedding     VECTOR(1536) NOT NULL,

  created_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(entity_type, entity_id, model_name, model_version)
);

-- ANN index for the embeddings table (cosine similarity)
CREATE INDEX IF NOT EXISTS idx_embeddings_vector
  ON embeddings USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);

-- Lookup index for fetching embeddings by entity
CREATE INDEX IF NOT EXISTS idx_embeddings_entity
  ON embeddings(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Operator note: to tune recall vs. speed at query time, set:
--   SET ivfflat.probes = 10;   -- default is 1; higher = better recall
-- This is a session-level GUC and should be set by the application layer
-- before running similarity searches, not hardcoded in the schema.
-- ---------------------------------------------------------------------------
