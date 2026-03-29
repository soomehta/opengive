/**
 * tRPC router — financials
 *
 * Exposes:
 *   financials.getFilings      — paginated financial filings for an org
 *   financials.getLatestFiling — single most-recent filing for an org
 *   financials.getRatios       — computed financial ratios extracted from a filing
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure } from '../trpc';
import {
  getFilings,
  getLatestFiling,
  getFilingsByYear,
  type FinancialFilingRow,
} from '@opengive/db/queries';

// ---------------------------------------------------------------------------
// Financial ratio shape
// ---------------------------------------------------------------------------

/**
 * The subset of computed ratio columns that the `getRatios` procedure returns.
 * These are pre-computed by the pipeline layer and stored on each filing row.
 * All values are 0–1 floats (or null when the underlying data is unavailable).
 */
export interface FinancialRatios {
  fiscalYear: number;
  /** Fraction of expenses spent on programs (0–1). Higher = more efficient. */
  programExpenseRatio: number | null;
  /** Fraction of expenses that are administrative overhead (0–1). */
  adminExpenseRatio: number | null;
  /** Fundraising cost per dollar raised. Lower = more efficient. */
  fundraisingEfficiency: number | null;
  /** (Current assets) / (Current liabilities) proxy. */
  workingCapitalRatio: number | null;
}

function toRatios(filing: FinancialFilingRow): FinancialRatios {
  return {
    fiscalYear: filing.fiscalYear,
    programExpenseRatio: filing.programExpenseRatio ?? null,
    adminExpenseRatio: filing.adminExpenseRatio ?? null,
    fundraisingEfficiency: filing.fundraisingEfficiency ?? null,
    workingCapitalRatio: filing.workingCapitalRatio ?? null,
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const financialsRouter = router({
  /**
   * Paginated financial filings for an organization, ordered by
   * (fiscalYear DESC, id DESC). Use this for list / history views.
   *
   * Returns: { items: FinancialFilingRow[], nextCursor: string | null }
   */
  getFilings: publicProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = await getFilings(ctx.db, {
        organizationId: input.orgId,
        cursor: input.cursor ?? null,
        limit: input.limit,
      });
      return result;
    }),

  /**
   * Returns the single most-recent filing for an organization.
   * Throws NOT_FOUND when the organization has no filings on record.
   */
  getLatestFiling: publicProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const filing = await getLatestFiling(ctx.db, input.orgId);
      if (!filing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `No financial filings found for organization "${input.orgId}"`,
        });
      }
      return filing;
    }),

  /**
   * Returns computed financial ratios for up to `years` most recent filings,
   * ordered chronologically (oldest first) — suitable for sparkline / trend charts.
   *
   * Each ratio entry corresponds to one fiscal year and contains only the
   * pre-computed ratio columns (not the full filing row).
   *
   * Returns: FinancialRatios[]
   */
  getRatios: publicProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
        years: z.number().int().min(1).max(20).default(5),
      }),
    )
    .query(async ({ ctx, input }) => {
      // getFilingsByYear returns rows oldest-first, which is the natural order
      // for time-series charts.
      const filings = await getFilingsByYear(ctx.db, input.orgId, input.years);
      return filings.map(toRatios);
    }),
});

export type FinancialsRouter = typeof financialsRouter;
