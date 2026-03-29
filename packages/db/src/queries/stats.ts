/**
 * Aggregation query builders for the Command Center dashboard.
 *
 * These queries power the global stats widgets, recent-activity feed, and
 * top-alerts panel.  They are intentionally simple aggregations — expensive
 * for very large datasets but acceptable at Phase 1 scale.  Production
 * deployments should consider materialised views or pg_cron pre-aggregation.
 */

import { sql } from 'drizzle-orm';
import type { Database } from '../client';

// ---------------------------------------------------------------------------
// GlobalStats
// ---------------------------------------------------------------------------

export interface GlobalStats {
  /** Total number of organizations in the database. */
  totalOrgs: number;
  /** Sum of all totalRevenue values across the latest filing per org (USD). */
  totalAmount: number;
  /** Number of distinct country codes in the organizations table. */
  countriesCovered: number;
  /** Number of unreviewed anomaly alerts at high or critical severity. */
  alertsCount: number;
}

/**
 * Returns a single aggregate stats object for the Command Center header.
 *
 * `totalAmount` is the sum of `total_revenue` from each organization's most
 * recent filing.  This is computed in a subquery so duplicates from multiple
 * fiscal years don't inflate the figure.
 */
export async function getGlobalStats(db: Database): Promise<GlobalStats> {
  const [orgStats, alertStats] = await Promise.all([
    // Org count, distinct countries, and sum of latest filings
    db.execute<{
      total_orgs: string;
      total_amount: string;
      countries_covered: string;
    }>(
      sql`
        WITH latest_filings AS (
          SELECT DISTINCT ON (organization_id)
            organization_id,
            total_revenue
          FROM financial_filings
          ORDER BY organization_id, fiscal_year DESC, id DESC
        )
        SELECT
          (SELECT COUNT(*) FROM organizations)::text          AS total_orgs,
          COALESCE(SUM(lf.total_revenue), 0)::text            AS total_amount,
          (SELECT COUNT(DISTINCT country_code) FROM organizations)::text
                                                              AS countries_covered
        FROM latest_filings lf
      `,
    ),

    // Unreviewed high/critical alerts
    db.execute<{ alerts_count: string }>(
      sql`
        SELECT COUNT(*)::text AS alerts_count
        FROM anomaly_alerts
        WHERE
          severity IN ('high', 'critical')
          AND is_reviewed = FALSE
      `,
    ),
  ]);

  const orgRow = orgStats[0];
  const alertRow = alertStats[0];

  return {
    totalOrgs: Number(orgRow?.total_orgs ?? 0),
    totalAmount: Number(orgRow?.total_amount ?? 0),
    countriesCovered: Number(orgRow?.countries_covered ?? 0),
    alertsCount: Number(alertRow?.alerts_count ?? 0),
  };
}

// ---------------------------------------------------------------------------
// RecentActivity
// ---------------------------------------------------------------------------

export interface RecentActivityItem {
  /** Synthetic identifier for deduplication: "<type>:<id>". */
  key: string;
  type: 'filing' | 'score_change';
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  /** Fiscal year (for filing events) or the year of the new score. */
  fiscalYear: number | null;
  /** New score value, populated for score_change events. */
  score: number | null;
  /** ISO-8601 timestamp of when the record was created. */
  occurredAt: string;
}

export interface PaginatedRecentActivity {
  items: RecentActivityItem[];
  nextCursor: string | null;
}

export interface GetRecentActivityParams {
  cursor?: string | null;
  limit?: number;
}

/**
 * Returns a merged, paginated feed of recent filings and score changes,
 * ordered by (occurredAt DESC, key DESC) for stable cursor pagination.
 *
 * Cursor format: base64url("<ISO-occurredAt>|<key>") where key is the
 * "<type>:<id>" synthetic identifier used above.
 */
export async function getRecentActivity(
  db: Database,
  params: GetRecentActivityParams,
): Promise<PaginatedRecentActivity> {
  const limit = Math.min(params.limit ?? 20, 100);

  // Decode cursor if provided
  let cursorOccurredAt: string | null = null;
  let cursorKey: string | null = null;

  if (params.cursor) {
    const raw = Buffer.from(params.cursor, 'base64url').toString('utf-8');
    const sepIdx = raw.indexOf('|');
    if (sepIdx !== -1) {
      cursorOccurredAt = raw.slice(0, sepIdx);
      cursorKey = raw.slice(sepIdx + 1);
    }
  }

  const cursorCondition =
    cursorOccurredAt !== null && cursorKey !== null
      ? sql`AND (occurred_at < ${cursorOccurredAt}::timestamptz
               OR (occurred_at = ${cursorOccurredAt}::timestamptz AND event_key < ${cursorKey}))`
      : sql``;

  const rows = await db.execute<{
    event_key: string;
    event_type: 'filing' | 'score_change';
    organization_id: string;
    organization_name: string;
    organization_slug: string;
    fiscal_year: string | null;
    score: string | null;
    occurred_at: string;
  }>(
    sql`
      WITH events AS (
        -- Recent financial filings
        SELECT
          'filing:' || ff.id          AS event_key,
          'filing'                    AS event_type,
          ff.organization_id,
          o.name                      AS organization_name,
          o.slug                      AS organization_slug,
          ff.fiscal_year::text        AS fiscal_year,
          NULL::text                  AS score,
          ff.created_at               AS occurred_at
        FROM financial_filings ff
        INNER JOIN organizations o ON o.id = ff.organization_id

        UNION ALL

        -- Recent accountability score records
        SELECT
          'score_change:' || os.id    AS event_key,
          'score_change'              AS event_type,
          os.organization_id,
          o.name                      AS organization_name,
          o.slug                      AS organization_slug,
          os.fiscal_year::text        AS fiscal_year,
          os.overall_score::text      AS score,
          os.created_at               AS occurred_at
        FROM organization_scores os
        INNER JOIN organizations o ON o.id = os.organization_id
      )
      SELECT *
      FROM events
      WHERE TRUE ${cursorCondition}
      ORDER BY occurred_at DESC, event_key DESC
      LIMIT ${limit + 1}
    `,
  );

  const hasNextPage = rows.length > limit;
  const items = (hasNextPage ? rows.slice(0, limit) : rows).map((r) => ({
    key: r.event_key,
    type: r.event_type,
    organizationId: r.organization_id,
    organizationName: r.organization_name,
    organizationSlug: r.organization_slug,
    fiscalYear: r.fiscal_year !== null ? Number(r.fiscal_year) : null,
    score: r.score !== null ? Number(r.score) : null,
    occurredAt: r.occurred_at,
  }));

  const lastItem = items.at(-1);
  const nextCursor =
    hasNextPage && lastItem
      ? Buffer.from(`${lastItem.occurredAt}|${lastItem.key}`).toString(
          'base64url',
        )
      : null;

  return { items, nextCursor };
}

// ---------------------------------------------------------------------------
// TopAlerts
// ---------------------------------------------------------------------------

export interface TopAlertItem {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  title: string;
  description: string;
  fiscalYear: number | null;
  createdAt: string;
}

/**
 * Returns the latest 10 unreviewed anomaly alerts at `high` or `critical`
 * severity, joined with the organization name and slug.
 *
 * Ordered by (severity weight DESC, createdAt DESC) so critical alerts always
 * surface above high ones.
 */
export async function getTopAlerts(db: Database): Promise<TopAlertItem[]> {
  const rows = await db.execute<{
    id: string;
    organization_id: string;
    organization_name: string;
    organization_slug: string;
    alert_type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: string;
    title: string;
    description: string;
    fiscal_year: string | null;
    created_at: string;
  }>(
    sql`
      SELECT
        aa.id,
        aa.organization_id,
        o.name   AS organization_name,
        o.slug   AS organization_slug,
        aa.alert_type,
        aa.severity,
        aa.confidence::text,
        aa.title,
        aa.description,
        aa.fiscal_year::text AS fiscal_year,
        aa.created_at::text  AS created_at
      FROM anomaly_alerts aa
      INNER JOIN organizations o ON o.id = aa.organization_id
      WHERE
        aa.severity IN ('high', 'critical')
        AND aa.is_reviewed = FALSE
      ORDER BY
        CASE aa.severity WHEN 'critical' THEN 2 WHEN 'high' THEN 1 ELSE 0 END DESC,
        aa.created_at DESC
      LIMIT 10
    `,
  );

  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    organizationName: r.organization_name,
    organizationSlug: r.organization_slug,
    alertType: r.alert_type,
    severity: r.severity,
    confidence: Number(r.confidence),
    title: r.title,
    description: r.description,
    fiscalYear: r.fiscal_year !== null ? Number(r.fiscal_year) : null,
    createdAt: r.created_at,
  }));
}
