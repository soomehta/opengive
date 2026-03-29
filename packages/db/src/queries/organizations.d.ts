/**
 * Query builders for the `organizations` table.
 *
 * All list functions use cursor-based pagination — never offset.
 * The cursor encodes (createdAt, id) so that the sort is stable even when
 * two rows share the same timestamp.
 */
import { organizations } from '../schema';
import type { Database } from '../client';
export interface DecodedCursor {
    id: string;
    createdAt: string;
}
/**
 * Encodes a stable pagination cursor from the last row in a result set.
 * Format: base64url( "<ISO-createdAt>|<UUID-id>" )
 */
export declare function encodeCursor(id: string, createdAt: string): string;
/**
 * Decodes a cursor back to its constituent parts.
 * Throws if the cursor payload is malformed.
 */
export declare function decodeCursor(cursor: string): DecodedCursor;
export type OrganizationRow = typeof organizations.$inferSelect;
export interface PaginatedResult<T> {
    items: T[];
    nextCursor: string | null;
}
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
export declare function searchOrganizations(db: Database, params: SearchOrganizationsParams): Promise<PaginatedResult<OrganizationRow>>;
/**
 * Fetches a single organization by its human-readable slug.
 * Returns `undefined` when no match is found.
 */
export declare function getOrganizationBySlug(db: Database, slug: string): Promise<OrganizationRow | undefined>;
/**
 * Fetches a single organization by its UUID primary key.
 * Returns `undefined` when no match is found.
 */
export declare function getOrganizationById(db: Database, id: string): Promise<OrganizationRow | undefined>;
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
export declare function listOrganizations(db: Database, params: ListOrganizationsParams): Promise<PaginatedResult<OrganizationRow>>;
//# sourceMappingURL=organizations.d.ts.map