/**
 * Query builders for the `financial_filings` table.
 *
 * All list functions use cursor-based pagination (never offset).
 * The cursor for filings encodes (fiscalYear DESC, id DESC) to provide a
 * natural chronological ordering within a given organization.
 */
import { financialFilings } from '../schema';
import type { Database } from '../client';
export type FinancialFilingRow = typeof financialFilings.$inferSelect;
/**
 * Encodes a filing cursor from (fiscalYear, id).
 * Stored as base64url( "<fiscalYear>|<id>" ).
 */
export declare function encodeFilingCursor(id: string, fiscalYear: number): string;
/**
 * Decodes a filing cursor back to (fiscalYear, id).
 */
export declare function decodeFilingCursor(cursor: string): {
    id: string;
    fiscalYear: number;
};
export interface GetFilingsParams {
    organizationId: string;
    limit?: number;
    cursor?: string | null;
}
export interface PaginatedFilings {
    items: FinancialFilingRow[];
    nextCursor: string | null;
}
/**
 * Returns paginated financial filings for a given organization, ordered by
 * fiscalYear DESC then id DESC (most recent first).
 */
export declare function getFilings(db: Database, params: GetFilingsParams): Promise<PaginatedFilings>;
/**
 * Returns the most recent (highest fiscalYear) filing for an organization.
 * Returns `undefined` when the organization has no filings.
 */
export declare function getLatestFiling(db: Database, organizationId: string): Promise<FinancialFilingRow | undefined>;
/**
 * Returns up to `years` most recent annual filings for an organization.
 * Useful for time-series charts that show N-year financial history.
 * Results are ordered by fiscalYear ASC so chart rendering is chronological.
 */
export declare function getFilingsByYear(db: Database, organizationId: string, years: number): Promise<FinancialFilingRow[]>;
//# sourceMappingURL=financials.d.ts.map