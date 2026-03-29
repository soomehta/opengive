/**
 * Query builders for the `grants` table (money-flow data).
 *
 * All list functions use cursor-based pagination (never offset).
 * The cursor encodes (createdAt DESC, id DESC) for stable ordering.
 */
import { eq, and, desc, lt, or, gte, sql } from 'drizzle-orm';
import { grants, organizations } from '../schema';
// ---------------------------------------------------------------------------
// Cursor helpers for grants
// ---------------------------------------------------------------------------
/**
 * Encodes a grant pagination cursor from (createdAt, id).
 * Stored as base64url( "<ISO-createdAt>|<UUID-id>" ).
 */
export function encodeGrantCursor(id, createdAt) {
    return Buffer.from(`${createdAt}|${id}`).toString('base64url');
}
/**
 * Decodes a grant cursor back to (createdAt, id).
 */
export function decodeGrantCursor(cursor) {
    const raw = Buffer.from(cursor, 'base64url').toString('utf-8');
    const separatorIdx = raw.indexOf('|');
    if (separatorIdx === -1) {
        throw new Error(`Invalid grant cursor: missing separator`);
    }
    const createdAt = raw.slice(0, separatorIdx);
    const id = raw.slice(separatorIdx + 1);
    if (!createdAt || !id) {
        throw new Error(`Invalid grant cursor: empty component`);
    }
    return { id, createdAt };
}
/**
 * Keyset condition for grants ordered DESC by (createdAt, id).
 */
function buildGrantCursorCondition(cursor) {
    return or(lt(grants.createdAt, new Date(cursor.createdAt)), and(eq(grants.createdAt, new Date(cursor.createdAt)), lt(grants.id, cursor.id)));
}
/**
 * Returns paginated grants made by a specific funding organization.
 * Ordered by createdAt DESC (most recently recorded first).
 */
export async function getGrantsByFunder(db, params) {
    const limit = Math.min(params.limit ?? 25, 100);
    const conditions = [eq(grants.funderOrgId, params.funderOrgId)];
    if (params.cursor) {
        const decoded = decodeGrantCursor(params.cursor);
        conditions.push(buildGrantCursorCondition(decoded));
    }
    const rows = await db
        .select()
        .from(grants)
        .where(and(...conditions))
        .orderBy(desc(grants.createdAt), desc(grants.id))
        .limit(limit + 1);
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);
    const nextCursor = hasNextPage && lastItem && lastItem.createdAt !== null
        ? encodeGrantCursor(lastItem.id, lastItem.createdAt.toISOString())
        : null;
    return { items, nextCursor };
}
/**
 * Returns paginated grants received by a specific organization.
 * Ordered by createdAt DESC (most recently recorded first).
 */
export async function getGrantsByRecipient(db, params) {
    const limit = Math.min(params.limit ?? 25, 100);
    const conditions = [
        eq(grants.recipientOrgId, params.recipientOrgId),
    ];
    if (params.cursor) {
        const decoded = decodeGrantCursor(params.cursor);
        conditions.push(buildGrantCursorCondition(decoded));
    }
    const rows = await db
        .select()
        .from(grants)
        .where(and(...conditions))
        .orderBy(desc(grants.createdAt), desc(grants.id))
        .limit(limit + 1);
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);
    const nextCursor = hasNextPage && lastItem && lastItem.createdAt !== null
        ? encodeGrantCursor(lastItem.id, lastItem.createdAt.toISOString())
        : null;
    return { items, nextCursor };
}
/**
 * Returns raw grant rows suitable for constructing Sankey / flow diagrams.
 * Filtered by optional country (recipient), fiscal year, and minimum USD
 * amount. Not paginated — callers should keep `limit` reasonable (<=500).
 * Results are ordered by amountUsd DESC so the largest flows appear first.
 */
export async function getFlowData(db, params) {
    const limit = Math.min(params.limit ?? 100, 500);
    const conditions = [];
    if (params.country) {
        conditions.push(eq(grants.recipientCountry, params.country));
    }
    if (params.year !== undefined) {
        conditions.push(eq(grants.fiscalYear, params.year));
    }
    if (params.minAmount !== undefined) {
        // amountUsd is NUMERIC — compare against string-serialised value so
        // Drizzle passes the correct Postgres type.
        conditions.push(gte(grants.amountUsd, params.minAmount.toFixed(2)));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    return db
        .select()
        .from(grants)
        .where(whereClause)
        .orderBy(desc(grants.amountUsd))
        .limit(limit);
}
/**
 * Aggregates grants into a Sankey-compatible `{ nodes, links }` structure.
 *
 * Each unique (funderOrgId, recipientOrgId) pair becomes a link whose `value`
 * is the sum of all matching USD amounts.  Node names are resolved by joining
 * the organizations table; anonymous funders/recipients fall back to the
 * `recipientName` text column or a synthetic "Unknown" label.
 *
 * Filtering by `sector` requires the funder organization's `sector` column to
 * match — this mirrors the dashboard "sector filter" UX expectation.
 *
 * Not paginated.  Use `limit` to cap the input row count.
 */
export async function getSankeyData(db, params) {
    const limit = Math.min(params.limit ?? 500, 2000);
    // Build WHERE conditions on the grants table
    const conditions = [];
    if (params.country) {
        conditions.push(eq(grants.recipientCountry, params.country));
    }
    if (params.year !== undefined) {
        conditions.push(eq(grants.fiscalYear, params.year));
    }
    if (params.minAmount !== undefined) {
        conditions.push(gte(grants.amountUsd, params.minAmount.toFixed(2)));
    }
    // Sector filter — join against funder org's sector field via a subquery
    // expressed as a raw SQL condition so we don't need a second round-trip.
    if (params.sector) {
        conditions.push(sql `${grants.funderOrgId} IN (
        SELECT id FROM organizations WHERE sector = ${params.sector}
      )`);
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    // Fetch raw grant rows up to the cap
    const rows = await db
        .select({
        id: grants.id,
        funderOrgId: grants.funderOrgId,
        recipientOrgId: grants.recipientOrgId,
        recipientName: grants.recipientName,
        recipientCountry: grants.recipientCountry,
        amountUsd: grants.amountUsd,
    })
        .from(grants)
        .where(whereClause)
        .orderBy(desc(grants.amountUsd))
        .limit(limit);
    if (rows.length === 0) {
        return { nodes: [], links: [] };
    }
    // Collect all unique org IDs that appear as funder or recipient
    const orgIds = new Set();
    for (const row of rows) {
        if (row.funderOrgId)
            orgIds.add(row.funderOrgId);
        if (row.recipientOrgId)
            orgIds.add(row.recipientOrgId);
    }
    // Bulk-fetch org names/countries for those IDs in a single query
    const orgMap = new Map();
    if (orgIds.size > 0) {
        const orgRows = await db
            .select({
            id: organizations.id,
            name: organizations.name,
            countryCode: organizations.countryCode,
        })
            .from(organizations)
            .where(sql `${organizations.id} = ANY(ARRAY[${sql.join([...orgIds].map((id) => sql `${id}::uuid`), sql `, `)}])`);
        for (const org of orgRows) {
            orgMap.set(org.id, { name: org.name, country: org.countryCode });
        }
    }
    const linkSums = new Map();
    const nodeIndex = new Map();
    for (const row of rows) {
        const funderId = row.funderOrgId ?? `anon:${row.recipientName ?? 'Unknown Funder'}`;
        const recipientId = row.recipientOrgId ??
            `anon:${row.recipientName ?? 'Unknown Recipient'}`;
        // Register nodes
        if (!nodeIndex.has(funderId)) {
            const org = row.funderOrgId ? orgMap.get(row.funderOrgId) : undefined;
            nodeIndex.set(funderId, {
                name: org?.name ?? 'Unknown Funder',
                country: org?.country ?? null,
            });
        }
        if (!nodeIndex.has(recipientId)) {
            const org = row.recipientOrgId
                ? orgMap.get(row.recipientOrgId)
                : undefined;
            nodeIndex.set(recipientId, {
                name: org?.name ?? row.recipientName ?? 'Unknown Recipient',
                country: org?.country ?? row.recipientCountry ?? null,
            });
        }
        // Skip self-loops (shouldn't happen, but guard defensively)
        if (funderId === recipientId)
            continue;
        const linkKey = `${funderId}|||${recipientId}`;
        const amount = row.amountUsd !== null ? Number(row.amountUsd) : 0;
        linkSums.set(linkKey, (linkSums.get(linkKey) ?? 0) + amount);
    }
    const nodes = [...nodeIndex.entries()].map(([id, meta]) => ({
        id,
        name: meta.name,
        country: meta.country,
    }));
    const links = [...linkSums.entries()].map(([key, value]) => {
        const sep = key.indexOf('|||');
        return {
            source: key.slice(0, sep),
            target: key.slice(sep + 3),
            value,
        };
    });
    // Sort links by value DESC so the largest flows are processed first by ECharts
    links.sort((a, b) => b.value - a.value);
    return { nodes, links };
}
/**
 * Aggregates grant flows by (funder country, recipient country) pair.
 * Used by the "By Country" view in the SankeyFlow component.
 *
 * The funder country is resolved from the joined organizations table.
 * Only rows where both funderOrgId and recipientCountry are known are included.
 *
 * Returns rows ordered by totalAmountUsd DESC.
 */
export async function getFlowsByCountry(db, params) {
    const limit = Math.min(params.limit ?? 200, 1000);
    // Build filter conditions
    const yearCondition = params.year !== undefined
        ? sql `g.fiscal_year = ${params.year}`
        : sql `TRUE`;
    const minAmountCondition = params.minAmount !== undefined
        ? sql `g.amount_usd >= ${params.minAmount.toFixed(2)}::numeric`
        : sql `TRUE`;
    // Raw SQL via Drizzle's sql template — Drizzle's query builder cannot
    // express GROUP BY across a joined column cleanly without raw fragments.
    const rows = await db.execute(sql `
      SELECT
        o.country_code            AS funder_country,
        g.recipient_country       AS recipient_country,
        COALESCE(SUM(g.amount_usd), 0)::text AS total_amount_usd,
        COUNT(*)::text            AS grant_count
      FROM grants g
      INNER JOIN organizations o ON o.id = g.funder_org_id
      WHERE
        g.funder_org_id IS NOT NULL
        AND g.recipient_country IS NOT NULL
        AND ${yearCondition}
        AND ${minAmountCondition}
      GROUP BY o.country_code, g.recipient_country
      ORDER BY SUM(g.amount_usd) DESC NULLS LAST
      LIMIT ${limit}
    `);
    return rows.map((r) => ({
        funderCountry: r.funder_country,
        recipientCountry: r.recipient_country,
        totalAmountUsd: Number(r.total_amount_usd),
        grantCount: Number(r.grant_count),
    }));
}
//# sourceMappingURL=flows.js.map