/**
 * Query builders for the `grants` table (money-flow data).
 *
 * All list functions use cursor-based pagination (never offset).
 * The cursor encodes (createdAt DESC, id DESC) for stable ordering.
 */
import { grants } from '../schema';
import type { Database } from '../client';
export type GrantRow = typeof grants.$inferSelect;
/**
 * Encodes a grant pagination cursor from (createdAt, id).
 * Stored as base64url( "<ISO-createdAt>|<UUID-id>" ).
 */
export declare function encodeGrantCursor(id: string, createdAt: string): string;
/**
 * Decodes a grant cursor back to (createdAt, id).
 */
export declare function decodeGrantCursor(cursor: string): {
    id: string;
    createdAt: string;
};
export interface PaginatedGrants {
    items: GrantRow[];
    nextCursor: string | null;
}
export interface GetGrantsByFunderParams {
    funderOrgId: string;
    limit?: number;
    cursor?: string | null;
}
/**
 * Returns paginated grants made by a specific funding organization.
 * Ordered by createdAt DESC (most recently recorded first).
 */
export declare function getGrantsByFunder(db: Database, params: GetGrantsByFunderParams): Promise<PaginatedGrants>;
export interface GetGrantsByRecipientParams {
    recipientOrgId: string;
    limit?: number;
    cursor?: string | null;
}
/**
 * Returns paginated grants received by a specific organization.
 * Ordered by createdAt DESC (most recently recorded first).
 */
export declare function getGrantsByRecipient(db: Database, params: GetGrantsByRecipientParams): Promise<PaginatedGrants>;
export interface GetFlowDataParams {
    country?: string;
    year?: number;
    minAmount?: number;
    limit?: number;
}
/**
 * Returns raw grant rows suitable for constructing Sankey / flow diagrams.
 * Filtered by optional country (recipient), fiscal year, and minimum USD
 * amount. Not paginated — callers should keep `limit` reasonable (<=500).
 * Results are ordered by amountUsd DESC so the largest flows appear first.
 */
export declare function getFlowData(db: Database, params: GetFlowDataParams): Promise<GrantRow[]>;
export interface SankeyNode {
    /** Stable identifier — org UUID or synthetic country/name key. */
    id: string;
    /** Display name shown on the Sankey diagram. */
    name: string;
    /** ISO 3166-1 alpha-2 country code, when available. */
    country: string | null;
}
export interface SankeyLink {
    /** `id` of the source SankeyNode. */
    source: string;
    /** `id` of the target SankeyNode. */
    target: string;
    /** Aggregated USD amount flowing from source to target. */
    value: number;
}
export interface SankeyData {
    nodes: SankeyNode[];
    links: SankeyLink[];
}
export interface GetSankeyDataParams {
    country?: string;
    year?: number;
    sector?: string;
    minAmount?: number;
    /** Hard cap on the number of raw grant rows scanned. Default 500, max 2000. */
    limit?: number;
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
export declare function getSankeyData(db: Database, params: GetSankeyDataParams): Promise<SankeyData>;
export interface CountryFlowRow {
    /** ISO 3166-1 alpha-2 code of the funding country. */
    funderCountry: string;
    /** ISO 3166-1 alpha-2 code of the recipient country. */
    recipientCountry: string;
    /** Total USD flowing from funderCountry to recipientCountry. */
    totalAmountUsd: number;
    /** Number of distinct grant records in this aggregate. */
    grantCount: number;
}
export interface GetFlowsByCountryParams {
    year?: number;
    minAmount?: number;
    /** Max number of country-pair rows to return. Default 200, max 1000. */
    limit?: number;
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
export declare function getFlowsByCountry(db: Database, params: GetFlowsByCountryParams): Promise<CountryFlowRow[]>;
//# sourceMappingURL=flows.d.ts.map