/**
 * Query builders for the `organizations` table.
 *
 * All list functions use cursor-based pagination — never offset.
 * The cursor encodes (createdAt, id) so that the sort is stable even when
 * two rows share the same timestamp.
 */

import { eq, sql, and, or, lt, desc, type SQL } from 'drizzle-orm';
import { organizations } from '../schema';
import type { Database } from '../client';

// ---------------------------------------------------------------------------
// Cursor helpers (exported so callers can re-encode from API responses)
// ---------------------------------------------------------------------------

export interface DecodedCursor {
  id: string;
  createdAt: string;
}

/**
 * Encodes a stable pagination cursor from the last row in a result set.
 * Format: base64url( "<ISO-createdAt>|<UUID-id>" )
 */
export function encodeCursor(id: string, createdAt: string): string {
  return Buffer.from(`${createdAt}|${id}`).toString('base64url');
}

/**
 * Decodes a cursor back to its constituent parts.
 * Throws if the cursor payload is malformed.
 */
export function decodeCursor(cursor: string): DecodedCursor {
  const raw = Buffer.from(cursor, 'base64url').toString('utf-8');
  const separatorIdx = raw.indexOf('|');
  if (separatorIdx === -1) {
    throw new Error(`Invalid pagination cursor: missing separator`);
  }
  const createdAt = raw.slice(0, separatorIdx);
  const id = raw.slice(separatorIdx + 1);
  if (!createdAt || !id) {
    throw new Error(`Invalid pagination cursor: empty component`);
  }
  return { id, createdAt };
}

// ---------------------------------------------------------------------------
// Inferred row type and column-level enum types
// ---------------------------------------------------------------------------

export type OrganizationRow = typeof organizations.$inferSelect;

/** Non-null status values as understood by the `status` column. */
type OrgStatusValue = NonNullable<OrganizationRow['status']>;

/** Non-null orgType values as understood by the `org_type` column. */
type OrgTypeValue = NonNullable<OrganizationRow['orgType']>;

// ---------------------------------------------------------------------------
// Paginated result shape
// ---------------------------------------------------------------------------

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Internal pagination helper
// ---------------------------------------------------------------------------

/**
 * Builds the WHERE clause fragment that implements "fetch rows after cursor".
 * Uses (createdAt, id) composite keyset so the ordering is deterministic.
 *
 * The condition is:
 *   (created_at < cursor.createdAt)
 *   OR (created_at = cursor.createdAt AND id < cursor.id)
 *
 * Results are ordered DESC by createdAt, then DESC by id.
 */
function buildCursorCondition(cursor: DecodedCursor): SQL {
  return or(
    lt(organizations.createdAt, new Date(cursor.createdAt)),
    and(
      eq(organizations.createdAt, new Date(cursor.createdAt)),
      lt(organizations.id, cursor.id),
    ),
  ) as SQL;
}

// ---------------------------------------------------------------------------
// searchOrganizations
// ---------------------------------------------------------------------------

export interface SearchOrganizationsParams {
  query?: string;
  country?: string;
  sector?: string;
  status?: string;
  cursor?: string | null;
  limit?: number;
}

/**
 * Full-text search over organizations using the Postgres `search_vector`
 * tsvector column together with optional equality filters.
 *
 * When `query` is provided the rows are ranked by ts_rank DESC so the most
 * relevant results appear first. Otherwise results are ordered by
 * createdAt DESC, id DESC for stable cursor pagination.
 */
export async function searchOrganizations(
  db: Database,
  params: SearchOrganizationsParams,
): Promise<PaginatedResult<OrganizationRow>> {
  const limit = Math.min(params.limit ?? 25, 100);
  const conditions: SQL[] = [];

  // Full-text filter
  if (params.query && params.query.trim().length > 0) {
    conditions.push(
      sql`${organizations.searchVector} @@ plainto_tsquery('english', ${params.query})`,
    );
  }

  // Equality filters
  if (params.country) {
    conditions.push(eq(organizations.countryCode, params.country));
  }
  if (params.sector) {
    conditions.push(eq(organizations.sector, params.sector));
  }
  if (params.status) {
    conditions.push(
      eq(organizations.status, params.status as OrgStatusValue),
    );
  }

  // Cursor condition (keyset pagination)
  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    conditions.push(buildCursorCondition(decoded));
  }

  const whereClause =
    conditions.length > 0 ? and(...conditions) : undefined;

  // When a query string is present, rank by relevance; otherwise by recency.
  const rows = await (params.query && params.query.trim().length > 0
    ? db
        .select()
        .from(organizations)
        .where(whereClause)
        .orderBy(
          desc(
            sql`ts_rank(${organizations.searchVector}, plainto_tsquery('english', ${params.query}))`,
          ),
          desc(organizations.createdAt),
          desc(organizations.id),
        )
        .limit(limit + 1)
    : db
        .select()
        .from(organizations)
        .where(whereClause)
        .orderBy(desc(organizations.createdAt), desc(organizations.id))
        .limit(limit + 1));

  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;

  const lastItem = items.at(-1);
  const nextCursor =
    hasNextPage && lastItem && lastItem.createdAt !== null
      ? encodeCursor(lastItem.id, lastItem.createdAt.toISOString())
      : null;

  return { items, nextCursor };
}

// ---------------------------------------------------------------------------
// getOrganizationBySlug
// ---------------------------------------------------------------------------

/**
 * Fetches a single organization by its human-readable slug.
 * Returns `undefined` when no match is found.
 */
export async function getOrganizationBySlug(
  db: Database,
  slug: string,
): Promise<OrganizationRow | undefined> {
  const rows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  return rows[0];
}

// ---------------------------------------------------------------------------
// getOrganizationById
// ---------------------------------------------------------------------------

/**
 * Fetches a single organization by its UUID primary key.
 * Returns `undefined` when no match is found.
 */
export async function getOrganizationById(
  db: Database,
  id: string,
): Promise<OrganizationRow | undefined> {
  const rows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);

  return rows[0];
}

// ---------------------------------------------------------------------------
// listOrganizations
// ---------------------------------------------------------------------------

export interface ListOrganizationsParams {
  cursor?: string | null;
  limit: number;
  country?: string;
  orgType?: string;
  status?: string;
}

/**
 * Paginated list of organizations with optional country / orgType / status
 * filters. Uses keyset pagination ordered by (createdAt DESC, id DESC).
 */
export async function listOrganizations(
  db: Database,
  params: ListOrganizationsParams,
): Promise<PaginatedResult<OrganizationRow>> {
  const limit = Math.min(params.limit, 100);
  const conditions: SQL[] = [];

  if (params.country) {
    conditions.push(eq(organizations.countryCode, params.country));
  }
  if (params.orgType) {
    conditions.push(
      eq(organizations.orgType, params.orgType as OrgTypeValue),
    );
  }
  if (params.status) {
    conditions.push(
      eq(organizations.status, params.status as OrgStatusValue),
    );
  }
  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    conditions.push(buildCursorCondition(decoded));
  }

  const whereClause =
    conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(organizations)
    .where(whereClause)
    .orderBy(desc(organizations.createdAt), desc(organizations.id))
    .limit(limit + 1);

  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;

  const lastItem = items.at(-1);
  const nextCursor =
    hasNextPage && lastItem && lastItem.createdAt !== null
      ? encodeCursor(lastItem.id, lastItem.createdAt.toISOString())
      : null;

  return { items, nextCursor };
}
