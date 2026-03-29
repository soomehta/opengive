/**
 * Query builders for analysis tables:
 *   - anomaly_alerts
 *   - organization_scores
 *   - entity_matches
 *
 * All list functions use cursor-based pagination (never offset).
 */
import { anomalyAlerts, organizationScores, entityMatches } from '../schema';
import type { Database } from '../client';
export type AnomalyAlertRow = typeof anomalyAlerts.$inferSelect;
export type OrganizationScoreRow = typeof organizationScores.$inferSelect;
export type EntityMatchRow = typeof entityMatches.$inferSelect;
/**
 * Encodes an anomaly alert pagination cursor from (createdAt, id).
 * Stored as base64url( "<ISO-createdAt>|<UUID-id>" ).
 */
export declare function encodeAlertCursor(id: string, createdAt: string): string;
/**
 * Decodes an anomaly alert cursor back to (createdAt, id).
 */
export declare function decodeAlertCursor(cursor: string): {
    id: string;
    createdAt: string;
};
export interface PaginatedAlerts {
    items: AnomalyAlertRow[];
    nextCursor: string | null;
}
export interface GetAnomalyAlertsParams {
    organizationId?: string;
    severity?: string;
    type?: string;
    limit?: number;
    cursor?: string | null;
}
/**
 * Returns paginated anomaly alerts, optionally filtered by organization,
 * severity level, and/or alert type.
 *
 * Ordered by createdAt DESC, id DESC (most recent alerts first).
 */
export declare function getAnomalyAlerts(db: Database, params: GetAnomalyAlertsParams): Promise<PaginatedAlerts>;
/**
 * Returns the organization score for a specific fiscal year.
 * When `fiscalYear` is omitted, returns the most recently computed score
 * (highest fiscal year, then most recently created).
 *
 * Returns `undefined` when no score record exists.
 */
export declare function getOrganizationScore(db: Database, organizationId: string, fiscalYear?: number): Promise<OrganizationScoreRow | undefined>;
/**
 * Returns all entity resolution matches where the given organization appears
 * as either `org_a_id` or `org_b_id`.
 *
 * Results are ordered by matchProbability DESC (highest confidence first) so
 * the most likely duplicates are surfaced at the top.
 *
 * Drizzle cannot express `OR` across two FK columns in a single `where()` call
 * cleanly with `and`, so we build two queries and union them manually. This
 * keeps the type system happy and avoids raw SQL.
 *
 * Returns an unordered flat list — callers may further filter by `reviewed`.
 */
export declare function getEntityMatches(db: Database, organizationId: string): Promise<EntityMatchRow[]>;
//# sourceMappingURL=analysis.d.ts.map