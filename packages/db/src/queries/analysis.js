/**
 * Query builders for analysis tables:
 *   - anomaly_alerts
 *   - organization_scores
 *   - entity_matches
 *
 * All list functions use cursor-based pagination (never offset).
 */
import { eq, and, desc, lt, or } from 'drizzle-orm';
import { anomalyAlerts, organizationScores, entityMatches, } from '../schema';
// ---------------------------------------------------------------------------
// Cursor helpers for anomaly alerts
// ---------------------------------------------------------------------------
/**
 * Encodes an anomaly alert pagination cursor from (createdAt, id).
 * Stored as base64url( "<ISO-createdAt>|<UUID-id>" ).
 */
export function encodeAlertCursor(id, createdAt) {
    return Buffer.from(`${createdAt}|${id}`).toString('base64url');
}
/**
 * Decodes an anomaly alert cursor back to (createdAt, id).
 */
export function decodeAlertCursor(cursor) {
    const raw = Buffer.from(cursor, 'base64url').toString('utf-8');
    const separatorIdx = raw.indexOf('|');
    if (separatorIdx === -1) {
        throw new Error(`Invalid alert cursor: missing separator`);
    }
    const createdAt = raw.slice(0, separatorIdx);
    const id = raw.slice(separatorIdx + 1);
    if (!createdAt || !id) {
        throw new Error(`Invalid alert cursor: empty component`);
    }
    return { id, createdAt };
}
/**
 * Keyset condition for anomaly alerts ordered DESC by (createdAt, id).
 */
function buildAlertCursorCondition(cursor) {
    return or(lt(anomalyAlerts.createdAt, new Date(cursor.createdAt)), and(eq(anomalyAlerts.createdAt, new Date(cursor.createdAt)), lt(anomalyAlerts.id, cursor.id)));
}
/**
 * Returns paginated anomaly alerts, optionally filtered by organization,
 * severity level, and/or alert type.
 *
 * Ordered by createdAt DESC, id DESC (most recent alerts first).
 */
export async function getAnomalyAlerts(db, params) {
    const limit = Math.min(params.limit ?? 25, 100);
    const conditions = [];
    if (params.organizationId) {
        conditions.push(eq(anomalyAlerts.organizationId, params.organizationId));
    }
    if (params.severity) {
        conditions.push(eq(anomalyAlerts.severity, params.severity));
    }
    if (params.type) {
        conditions.push(eq(anomalyAlerts.alertType, params.type));
    }
    if (params.cursor) {
        const decoded = decodeAlertCursor(params.cursor);
        conditions.push(buildAlertCursorCondition(decoded));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db
        .select()
        .from(anomalyAlerts)
        .where(whereClause)
        .orderBy(desc(anomalyAlerts.createdAt), desc(anomalyAlerts.id))
        .limit(limit + 1);
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);
    const nextCursor = hasNextPage && lastItem && lastItem.createdAt !== null
        ? encodeAlertCursor(lastItem.id, lastItem.createdAt.toISOString())
        : null;
    return { items, nextCursor };
}
// ---------------------------------------------------------------------------
// getOrganizationScore
// ---------------------------------------------------------------------------
/**
 * Returns the organization score for a specific fiscal year.
 * When `fiscalYear` is omitted, returns the most recently computed score
 * (highest fiscal year, then most recently created).
 *
 * Returns `undefined` when no score record exists.
 */
export async function getOrganizationScore(db, organizationId, fiscalYear) {
    const conditions = [
        eq(organizationScores.organizationId, organizationId),
    ];
    if (fiscalYear !== undefined) {
        conditions.push(eq(organizationScores.fiscalYear, fiscalYear));
    }
    const rows = await db
        .select()
        .from(organizationScores)
        .where(and(...conditions))
        .orderBy(desc(organizationScores.fiscalYear), desc(organizationScores.createdAt))
        .limit(1);
    return rows[0];
}
// ---------------------------------------------------------------------------
// getEntityMatches
// ---------------------------------------------------------------------------
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
export async function getEntityMatches(db, organizationId) {
    // Rows where this org is on the left side
    const asOrgA = await db
        .select()
        .from(entityMatches)
        .where(eq(entityMatches.orgAId, organizationId))
        .orderBy(desc(entityMatches.matchProbability));
    // Rows where this org is on the right side
    const asOrgB = await db
        .select()
        .from(entityMatches)
        .where(eq(entityMatches.orgBId, organizationId))
        .orderBy(desc(entityMatches.matchProbability));
    // Merge, de-duplicate by id, and re-sort
    const seen = new Set();
    const merged = [];
    for (const row of [...asOrgA, ...asOrgB]) {
        if (!seen.has(row.id)) {
            seen.add(row.id);
            merged.push(row);
        }
    }
    merged.sort((a, b) => b.matchProbability - a.matchProbability);
    return merged;
}
//# sourceMappingURL=analysis.js.map