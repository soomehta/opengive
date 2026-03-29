/**
 * Aggregation query builders for the Command Center dashboard.
 *
 * These queries power the global stats widgets, recent-activity feed, and
 * top-alerts panel.  They are intentionally simple aggregations — expensive
 * for very large datasets but acceptable at Phase 1 scale.  Production
 * deployments should consider materialised views or pg_cron pre-aggregation.
 */
import type { Database } from '../client';
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
export declare function getGlobalStats(db: Database): Promise<GlobalStats>;
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
export declare function getRecentActivity(db: Database, params: GetRecentActivityParams): Promise<PaginatedRecentActivity>;
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
export declare function getTopAlerts(db: Database): Promise<TopAlertItem[]>;
//# sourceMappingURL=stats.d.ts.map