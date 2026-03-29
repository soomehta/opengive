/**
 * tRPC router — stats (Command Center aggregations)
 *
 * Exposes:
 *   stats.getGlobalStats     — headline numbers for the dashboard header
 *   stats.getRecentActivity  — merged paginated feed of filings and score changes
 *   stats.getTopAlerts       — latest 10 unreviewed high/critical anomaly alerts
 */

import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import {
  getGlobalStats,
  getRecentActivity,
  getTopAlerts,
} from '@opengive/db/queries';

export const statsRouter = router({
  /**
   * Returns global aggregate statistics for the Command Center header panel.
   *
   * Returns: {
   *   totalOrgs: number,
   *   totalAmount: number,    // sum of latest-filing total_revenue across all orgs (USD)
   *   countriesCovered: number,
   *   alertsCount: number     // unreviewed high/critical anomaly alerts
   * }
   */
  getGlobalStats: publicProcedure.query(async ({ ctx }) => {
    const stats = await getGlobalStats(ctx.db);
    return stats;
  }),

  /**
   * Returns a paginated merged feed of recent financial filings and
   * accountability score changes, ordered newest-first.
   *
   * Uses cursor-based pagination: pass the `nextCursor` from one response as
   * the `cursor` of the next request.
   *
   * Returns: {
   *   items: RecentActivityItem[],
   *   nextCursor: string | null
   * }
   *
   * Each item carries:
   *   type: 'filing' | 'score_change'
   *   organizationId, organizationName, organizationSlug
   *   fiscalYear, score (null for filing events)
   *   occurredAt: ISO-8601
   */
  getRecentActivity: publicProcedure
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = await getRecentActivity(ctx.db, {
        cursor: input.cursor ?? null,
        limit: input.limit,
      });
      return result;
    }),

  /**
   * Returns the latest 10 unreviewed anomaly alerts at `high` or `critical`
   * severity, joined with organization name and slug.
   *
   * Ordered by severity weight (critical > high) then recency.
   * Not paginated — always returns at most 10 rows.
   *
   * Returns: TopAlertItem[]
   */
  getTopAlerts: publicProcedure.query(async ({ ctx }) => {
    const alerts = await getTopAlerts(ctx.db);
    return alerts;
  }),
});

export type StatsRouter = typeof statsRouter;
