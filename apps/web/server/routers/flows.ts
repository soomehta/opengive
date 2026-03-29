/**
 * tRPC router — flows (grant money flows)
 *
 * Exposes:
 *   flows.getByFunder     — paginated grants made by a funding organization
 *   flows.getByRecipient  — paginated grants received by an organization
 *   flows.getFlowData     — Sankey-compatible { nodes, links } structure
 *   flows.getByCountry    — aggregated flows by country pair for the "By Country" view
 */

import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import {
  getGrantsByFunder,
  getGrantsByRecipient,
  getSankeyData,
  getFlowsByCountry,
} from '@opengive/db/queries';

export const flowsRouter = router({
  /**
   * Paginated grants made by a specific funding organization.
   * Ordered by (createdAt DESC, id DESC).
   *
   * Returns: { items: GrantRow[], nextCursor: string | null }
   */
  getByFunder: publicProcedure
    .input(
      z.object({
        funderOrgId: z.string().uuid(),
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = await getGrantsByFunder(ctx.db, {
        funderOrgId: input.funderOrgId,
        cursor: input.cursor ?? null,
        limit: input.limit,
      });
      return result;
    }),

  /**
   * Paginated grants received by a specific organization.
   * Ordered by (createdAt DESC, id DESC).
   *
   * Returns: { items: GrantRow[], nextCursor: string | null }
   */
  getByRecipient: publicProcedure
    .input(
      z.object({
        recipientOrgId: z.string().uuid(),
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = await getGrantsByRecipient(ctx.db, {
        recipientOrgId: input.recipientOrgId,
        cursor: input.cursor ?? null,
        limit: input.limit,
      });
      return result;
    }),

  /**
   * Returns Sankey-compatible data for flow diagram visualizations.
   *
   * Aggregates grants by (funder, recipient) pair and resolves org names.
   * Supports filtering by country, year, sector, and minimum USD amount.
   *
   * Returns: {
   *   nodes: { id: string, name: string, country: string | null }[],
   *   links: { source: string, target: string, value: number }[]
   * }
   */
  getFlowData: publicProcedure
    .input(
      z.object({
        country: z.string().length(2).toUpperCase().optional(),
        year: z.number().int().min(1900).max(2100).optional(),
        sector: z.string().optional(),
        minAmount: z.number().nonnegative().optional(),
        limit: z.number().int().min(1).max(2000).default(500),
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = await getSankeyData(ctx.db, {
        country: input.country,
        year: input.year,
        sector: input.sector,
        minAmount: input.minAmount,
        limit: input.limit,
      });
      return result;
    }),

  /**
   * Returns aggregated grant flows grouped by (funder country, recipient country).
   * Used by the "By Country" view in the SankeyFlow component.
   *
   * Supports optional filtering by year and minimum grant amount.
   *
   * Returns: {
   *   funderCountry: string,
   *   recipientCountry: string,
   *   totalAmountUsd: number,
   *   grantCount: number
   * }[]
   */
  getByCountry: publicProcedure
    .input(
      z.object({
        year: z.number().int().min(1900).max(2100).optional(),
        minAmount: z.number().nonnegative().optional(),
        limit: z.number().int().min(1).max(1000).default(200),
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = await getFlowsByCountry(ctx.db, {
        year: input.year,
        minAmount: input.minAmount,
        limit: input.limit,
      });
      return result;
    }),
});

export type FlowsRouter = typeof flowsRouter;
