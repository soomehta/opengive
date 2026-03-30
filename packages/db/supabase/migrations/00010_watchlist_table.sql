CREATE TABLE IF NOT EXISTS watchlist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  watch_type      TEXT NOT NULL DEFAULT 'all'
                  CHECK (watch_type IN ('all', 'score_change', 'new_filing', 'anomaly_alert', 'grant_activity')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, organization_id)
);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_org_id ON watchlist(organization_id);
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own watchlist" ON watchlist;
CREATE POLICY "Users own watchlist" ON watchlist FOR ALL USING (auth.uid() = user_id);
