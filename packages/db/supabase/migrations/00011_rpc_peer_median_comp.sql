-- RPC function for peer median CEO compensation (used by anomaly detection)
CREATE OR REPLACE FUNCTION get_peer_median_ceo_comp(
  org_id_param UUID, revenue_low NUMERIC, revenue_high NUMERIC
) RETURNS NUMERIC AS $$
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY op.compensation)
  FROM organization_people op
  JOIN organizations o ON o.id = op.organization_id
  JOIN financial_filings ff ON ff.organization_id = op.organization_id
  WHERE op.organization_id != org_id_param
    AND ff.total_revenue BETWEEN revenue_low AND revenue_high
    AND op.compensation IS NOT NULL
    AND op.role IN ('officer', 'president', 'ceo', 'executive_director')
$$ LANGUAGE sql STABLE;
