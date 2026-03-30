-- RPC function for semantic search via pgvector (used by embedding service)
CREATE OR REPLACE FUNCTION match_organizations(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  sector TEXT,
  country_code TEXT,
  similarity FLOAT
) AS $$
  SELECT
    o.id, o.name, o.slug, o.sector, o.country_code,
    1 - (o.embedding <=> query_embedding) AS similarity
  FROM organizations o
  WHERE o.embedding IS NOT NULL
  ORDER BY o.embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE sql STABLE;
