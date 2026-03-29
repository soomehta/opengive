/**
 * tRPC router — organizations
 *
 * Exposes:
 *   organizations.search          — full-text + filter search with cursor pagination
 *   organizations.list             — paginated list (no text relevance ranking)
 *   organizations.getBySlug        — single org by human-readable slug
 *   organizations.getById          — single org by UUID
 *   organizations.getFinancials    — N-year financial history for an org
 *   organizations.getFilings       — paginated financial filings for an org
 *   organizations.getAlerts        — paginated anomaly alerts for an org
 *   organizations.getRelatedEntities — entity resolution matches
 *   organizations.getScore         — latest (or year-specific) accountability score
 *   organizations.getPeople        — directors / trustees / officers
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import {
  searchOrganizations,
  listOrganizations,
  getOrganizationBySlug,
  getOrganizationById,
  getFilingsByYear,
  getFilings,
  getAnomalyAlerts,
  getOrganizationScore,
  getEntityMatches,
} from '@opengive/db/queries';
import { organizationPeople, people } from '@opengive/db/schema';

// ---------------------------------------------------------------------------
// Re-usable input schemas
// ---------------------------------------------------------------------------

const orgStatusSchema = z.enum([
  'active',
  'inactive',
  'dissolved',
  'suspended',
  'unknown',
]);

const cursorPaginationSchema = {
  cursor: z.string().nullish(),
  limit: z.number().int().min(1).max(100).default(25),
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const organizationRouter = router({
  /**
   * Full-text + filter search over organizations.
   *
   * When `query` is provided results are ranked by ts_rank DESC (pg_trgm +
   * tsvector weighted search). Without a query, results are ordered by
   * createdAt DESC for stable cursor pagination.
   *
   * Returns: { items: OrganizationRow[], nextCursor: string | null }
   */
  search: publicProcedure
    .input(
      z.object({
        query: z.string().trim().optional(),
        country: z.string().length(2).toUpperCase().optional(),
        sector: z.string().optional(),
        status: orgStatusSchema.optional(),
        ...cursorPaginationSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = await searchOrganizations(ctx.db, {
        query: input.query,
        country: input.country,
        sector: input.sector,
        status: input.status,
        cursor: input.cursor ?? null,
        limit: input.limit,
      });
      return result;
    }),

  /**
   * Paginated list of organizations with optional equality filters.
   * No relevance ranking — ordered by (createdAt DESC, id DESC).
   *
   * Returns: { items: OrganizationRow[], nextCursor: string | null }
   */
  list: publicProcedure
    .input(
      z.object({
        country: z.string().length(2).toUpperCase().optional(),
        orgType: z.string().optional(),
        status: orgStatusSchema.optional(),
        ...cursorPaginationSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = await listOrganizations(ctx.db, {
        country: input.country,
        orgType: input.orgType,
        status: input.status,
        cursor: input.cursor ?? null,
        limit: input.limit,
      });
      return result;
    }),

  /**
   * Fetch a single organization by its human-readable slug.
   * Throws NOT_FOUND when the slug does not exist.
   */
  getBySlug: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const org = await getOrganizationBySlug(ctx.db, input.slug);
      if (!org) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Organization with slug "${input.slug}" not found`,
        });
      }
      return org;
    }),

  /**
   * Fetch a single organization by UUID.
   * Throws NOT_FOUND when the id does not exist.
   */
  getById: publicProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const org = await getOrganizationById(ctx.db, input.orgId);
      if (!org) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Organization "${input.orgId}" not found`,
        });
      }
      return org;
    }),

  /**
   * Returns up to `years` most recent annual filings for an organization,
   * ordered chronologically (oldest first) — suitable for time-series charts.
   *
   * Returns: FinancialFilingRow[]
   */
  getFinancials: publicProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
        years: z.number().int().min(1).max(20).default(5),
      }),
    )
    .query(async ({ ctx, input }) => {
      const filings = await getFilingsByYear(ctx.db, input.orgId, input.years);
      return filings;
    }),

  /**
   * Paginated financial filings for an organization, ordered by
   * (fiscalYear DESC, id DESC). Suitable for a "filing history" list view.
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
   * Paginated anomaly alerts for an organization, ordered by
   * (createdAt DESC, id DESC). Supports optional severity / type filtering.
   *
   * Returns: { items: AnomalyAlertRow[], nextCursor: string | null }
   */
  getAlerts: publicProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
        severity: z
          .enum(['low', 'medium', 'high', 'critical'])
          .optional(),
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
   * Returns all entity resolution matches where this organization appears on
   * either side, ordered by matchProbability DESC.
   *
   * Returns: EntityMatchRow[]
   */
  getRelatedEntities: publicProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const matches = await getEntityMatches(ctx.db, input.orgId);
      return matches;
    }),

  /**
   * Returns the accountability score for an organization.
   * When `fiscalYear` is omitted, returns the most recently computed score.
   * Returns null when no score record exists yet.
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
   * Returns all people (directors, trustees, officers, etc.) associated with
   * an organization, joined with the people table for name/normalized-name.
   *
   * Results are ordered by isCurrent DESC (current roles first), then
   * filingYear DESC so the most recent historical roles follow.
   *
   * Returns: Array of joined organization_people + people rows
   */
  getPeople: publicProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          // organization_people columns
          id: organizationPeople.id,
          organizationId: organizationPeople.organizationId,
          personId: organizationPeople.personId,
          role: organizationPeople.role,
          title: organizationPeople.title,
          compensation: organizationPeople.compensation,
          currency: organizationPeople.currency,
          startDate: organizationPeople.startDate,
          endDate: organizationPeople.endDate,
          isCurrent: organizationPeople.isCurrent,
          filingYear: organizationPeople.filingYear,
          createdAt: organizationPeople.createdAt,
          // people columns
          personName: people.name,
          personNameNormalized: people.nameNormalized,
          personEntityClusterId: people.entityClusterId,
        })
        .from(organizationPeople)
        .innerJoin(people, eq(organizationPeople.personId, people.id))
        .where(eq(organizationPeople.organizationId, input.orgId))
        .orderBy(
          // isCurrent DESC — booleans: true > false in Postgres DESC order
          // Drizzle represents boolean columns as boolean; use sql for DESC sort
          // on a boolean column which Drizzle handles correctly via .orderBy(desc(...))
        );

      // Sort in JS: current roles first, then by filing year descending.
      rows.sort((a, b) => {
        if (a.isCurrent === b.isCurrent) {
          return (b.filingYear ?? 0) - (a.filingYear ?? 0);
        }
        return a.isCurrent ? -1 : 1;
      });

      return rows;
    }),
});

export type OrganizationRouter = typeof organizationRouter;
