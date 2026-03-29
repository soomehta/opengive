/**
 * tRPC router — analysis
 *
 * Exposes:
 *   analysis.getAlerts     — paginated anomaly alerts with optional filters
 *   analysis.getScore      — accountability score for an org / year
 *   analysis.getMatches    — entity resolution matches for an org
 */

import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import {
  getAnomalyAlerts,
  getOrganizationScore,
  getEntityMatches,
} from '@opengive/db/queries';

export const analysisRouter = router({
  /**
   * Paginated anomaly alerts, optionally filtered by organization, severity,
   * and/or alert type. Ordered by (createdAt DESC, id DESC).
   *
   * Returns: { items: AnomalyAlertRow[], nextCursor: string | null }
   */
  getAlerts: publicProcedure
    .input(
      z.object({
        orgId: z.string().uuid().optional(),
        severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        type: z
          .enum([
            'overhead_manipulation',
            'related_party',
            'compensation_outlier',
            'revenue_expense_mismatch',
            'benford_violation',
            'network_anomaly',
            'filing_inconsistency',
            'geographic_discrepancy',
            'zero_fundraising',
            'rapid_growth',
            'shell_indicator',
            'other',
          ])
          .optional(),
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = await getAnomalyAlerts(ctx.db, {
        organizationId: input.orgId,
        severity: input.severity,
        type: input.type,
        cursor: input.cursor ?? null,
        limit: input.limit,
      });
      return result;
    }),

  /**
   * Returns the accountability score for a given organization.
   * When `fiscalYear` is omitted the most recently computed score is returned.
   * Returns null when no score record exists for the requested year.
   */
  getScore: publicProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
        fiscalYear: z.number().int().min(1900).max(2100).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const score = await getOrganizationScore(
        ctx.db,
        input.orgId,
        input.fiscalYear,
      );
      return score ?? null;
    }),

  /**
   * Returns all entity resolution matches where the given organization
   * appears as either org_a or org_b. Ordered by matchProbability DESC.
   *
   * Returns: EntityMatchRow[]
   */
  getMatches: publicProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const matches = await getEntityMatches(ctx.db, input.orgId);
      return matches;
    }),
});

export type AnalysisRouter = typeof analysisRouter;
