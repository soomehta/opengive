/**
 * tRPC router — watchlist
 *
 * All procedures are protected (require authentication).
 *
 * Exposes:
 *   watchlist.list      — paginated list joined with organizations
 *   watchlist.add       — insert watchlist entry
 *   watchlist.remove    — delete a watchlist entry by organizationId
 *   watchlist.update    — change the watch_type for an existing entry
 *   watchlist.isWatched — check if the authed user is watching an org
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, lt, or, desc } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { watchlist, organizations } from '@opengive/db/schema';

// ---------------------------------------------------------------------------
// Shared enum
// ---------------------------------------------------------------------------

const watchTypeSchema = z.enum([
  'all',
  'score_change',
  'new_filing',
  'anomaly_alert',
  'grant_activity',
]);

// ---------------------------------------------------------------------------
// Cursor helpers
// ---------------------------------------------------------------------------

function encodeWatchlistCursor(id: string, createdAt: string): string {
  return Buffer.from(`${createdAt}|${id}`).toString('base64url');
}

function decodeWatchlistCursor(cursor: string): { id: string; createdAt: string } {
  const raw = Buffer.from(cursor, 'base64url').toString('utf-8');
  const sep = raw.indexOf('|');
  if (sep === -1) throw new Error('Invalid watchlist cursor');
  return { createdAt: raw.slice(0, sep), id: raw.slice(sep + 1) };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const watchlistRouter = router({
  /**
   * List the authenticated user's watchlist entries, joined with organization
   * name, slug, countryCode, and sector. Cursor-paginated by createdAt DESC.
   */
  list: protectedProcedure
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit;

      const conditions = [eq(watchlist.userId, ctx.userId)];

      if (input.cursor) {
        const decoded = decodeWatchlistCursor(input.cursor);
        conditions.push(
          or(
            lt(watchlist.createdAt, new Date(decoded.createdAt)),
            and(
              eq(watchlist.createdAt, new Date(decoded.createdAt)),
              lt(watchlist.id, decoded.id),
            ),
          ) as ReturnType<typeof eq>,
        );
      }

      const rows = await ctx.db
        .select({
          id: watchlist.id,
          organizationId: watchlist.organizationId,
          watchType: watchlist.watchType,
          createdAt: watchlist.createdAt,
          orgName: organizations.name,
          orgSlug: organizations.slug,
          orgCountryCode: organizations.countryCode,
          orgSector: organizations.sector,
        })
        .from(watchlist)
        .innerJoin(organizations, eq(watchlist.organizationId, organizations.id))
        .where(and(...conditions))
        .orderBy(desc(watchlist.createdAt), desc(watchlist.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const lastItem = items[items.length - 1];
      const nextCursor =
        hasMore && lastItem?.createdAt
          ? encodeWatchlistCursor(lastItem.id, lastItem.createdAt.toISOString())
          : null;

      return { items, nextCursor };
    }),

  /**
   * Add an organization to the authenticated user's watchlist.
   */
  add: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        watchType: watchTypeSchema.default('all'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(watchlist)
        .values({
          userId: ctx.userId,
          organizationId: input.organizationId,
          watchType: input.watchType,
        })
        .onConflictDoNothing()
        .returning();

      return row ?? null;
    }),

  /**
   * Remove a watchlist entry for the authenticated user by organizationId.
   * Throws NOT_FOUND when no matching entry exists.
   */
  remove: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db
        .delete(watchlist)
        .where(
          and(
            eq(watchlist.userId, ctx.userId),
            eq(watchlist.organizationId, input.organizationId),
          ),
        )
        .returning({ id: watchlist.id });

      if (deleted.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Watchlist entry not found' });
      }

      return { success: true };
    }),

  /**
   * Change the watch_type for an existing watchlist entry.
   * Throws NOT_FOUND when no matching entry exists.
   */
  update: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        watchType: watchTypeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db
        .update(watchlist)
        .set({ watchType: input.watchType })
        .where(
          and(
            eq(watchlist.userId, ctx.userId),
            eq(watchlist.organizationId, input.organizationId),
          ),
        )
        .returning();

      if (updated.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Watchlist entry not found' });
      }

      return updated[0];
    }),

  /**
   * Check whether the authenticated user is watching a given organization.
   * Returns { watched: boolean, watchType?: string | null }.
   */
  isWatched: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({ id: watchlist.id, watchType: watchlist.watchType })
        .from(watchlist)
        .where(
          and(
            eq(watchlist.userId, ctx.userId),
            eq(watchlist.organizationId, input.organizationId),
          ),
        )
        .limit(1);

      if (rows.length === 0) {
        return { watched: false, watchType: null };
      }

      return { watched: true, watchType: rows[0]!.watchType };
    }),
});

export type WatchlistRouter = typeof watchlistRouter;
