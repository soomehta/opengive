/**
 * Query builders for the `financial_filings` table.
 *
 * All list functions use cursor-based pagination (never offset).
 * The cursor for filings encodes (fiscalYear DESC, id DESC) to provide a
 * natural chronological ordering within a given organization.
 */

import { eq, and, desc, lt, or, type SQL } from 'drizzle-orm';
import { financialFilings } from '../schema';
import type { Database } from '../client';
import { encodeCursor, decodeCursor } from './organizations';

// ---------------------------------------------------------------------------
// Inferred row type
// ---------------------------------------------------------------------------

export type FinancialFilingRow = typeof financialFilings.$inferSelect;

// ---------------------------------------------------------------------------
// Internal cursor helpers for filings
// ---------------------------------------------------------------------------

/**
 * Encodes a filing cursor from (fiscalYear, id).
 * Stored as base64url( "<fiscalYear>|<id>" ).
 */
export function encodeFilingCursor(id: string, fiscalYear: number): string {
  return Buffer.from(`${fiscalYear}|${id}`).toString('base64url');
}

/**
 * Decodes a filing cursor back to (fiscalYear, id).
 */
export function decodeFilingCursor(cursor: string): {
  id: string;
  fiscalYear: number;
} {
  const raw = Buffer.from(cursor, 'base64url').toString('utf-8');
  const separatorIdx = raw.indexOf('|');
  if (separatorIdx === -1) {
    throw new Error(`Invalid filing cursor: missing separator`);
  }
  const fiscalYearStr = raw.slice(0, separatorIdx);
  const id = raw.slice(separatorIdx + 1);
  const fiscalYear = Number(fiscalYearStr);
  if (!Number.isFinite(fiscalYear) || !id) {
    throw new Error(`Invalid filing cursor: malformed component`);
  }
  return { id, fiscalYear };
}

/**
 * Keyset condition for filings: (fiscalYear, id) DESC ordering.
 *
 *   fiscal_year < cursor.fiscalYear
 *   OR (fiscal_year = cursor.fiscalYear AND id < cursor.id)
 */
function buildFilingCursorCondition(cursor: {
  id: string;
  fiscalYear: number;
}): SQL {
  return (
    or(
      lt(financialFilings.fiscalYear, cursor.fiscalYear),
      and(
        eq(financialFilings.fiscalYear, cursor.fiscalYear),
        lt(financialFilings.id, cursor.id),
      ),
    ) as SQL
  );
}

// ---------------------------------------------------------------------------
// getFilings
// ---------------------------------------------------------------------------

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
export async function getFilings(
  db: Database,
  params: GetFilingsParams,
): Promise<PaginatedFilings> {
  const limit = Math.min(params.limit ?? 25, 100);
  const conditions: SQL[] = [
    eq(financialFilings.organizationId, params.organizationId),
  ];

  if (params.cursor) {
    const decoded = decodeFilingCursor(params.cursor);
    conditions.push(buildFilingCursorCondition(decoded));
  }

  const rows = await db
    .select()
    .from(financialFilings)
    .where(and(...conditions))
    .orderBy(desc(financialFilings.fiscalYear), desc(financialFilings.id))
    .limit(limit + 1);

  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;

  const lastItem = items.at(-1);
  const nextCursor =
    hasNextPage && lastItem
      ? encodeFilingCursor(lastItem.id, lastItem.fiscalYear)
      : null;

  return { items, nextCursor };
}

// ---------------------------------------------------------------------------
// getLatestFiling
// ---------------------------------------------------------------------------

/**
 * Returns the most recent (highest fiscalYear) filing for an organization.
 * Returns `undefined` when the organization has no filings.
 */
export async function getLatestFiling(
  db: Database,
  organizationId: string,
): Promise<FinancialFilingRow | undefined> {
  const rows = await db
    .select()
    .from(financialFilings)
    .where(eq(financialFilings.organizationId, organizationId))
    .orderBy(desc(financialFilings.fiscalYear), desc(financialFilings.id))
    .limit(1);

  return rows[0];
}

// ---------------------------------------------------------------------------
// getFilingsByYear
// ---------------------------------------------------------------------------

/**
 * Returns up to `years` most recent annual filings for an organization.
 * Useful for time-series charts that show N-year financial history.
 * Results are ordered by fiscalYear ASC so chart rendering is chronological.
 */
export async function getFilingsByYear(
  db: Database,
  organizationId: string,
  years: number,
): Promise<FinancialFilingRow[]> {
  const clampedYears = Math.min(Math.max(years, 1), 20);

  // Sub-select to get the most recent N fiscal years, then return ordered ASC.
  // Drizzle does not support LIMIT inside a subquery directly, so we fetch
  // DESC-ordered rows and reverse them in JS — acceptable for small N.
  const rows = await db
    .select()
    .from(financialFilings)
    .where(eq(financialFilings.organizationId, organizationId))
    .orderBy(desc(financialFilings.fiscalYear), desc(financialFilings.id))
    .limit(clampedYears);

  // Reverse so callers receive chronological order (oldest first).
  return rows.reverse();
}
