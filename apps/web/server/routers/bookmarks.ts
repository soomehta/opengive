/**
 * tRPC router — bookmarks
 *
 * All procedures are protected (require authentication).
 *
 * Exposes:
 *   bookmarks.list         — paginated list joined with organizations
 *   bookmarks.add          — insert bookmark, ignore if already exists
 *   bookmarks.remove       — delete a bookmark by organizationId
 *   bookmarks.updateNotes  — update the notes field on a bookmark
 *   bookmarks.isBookmarked — check if the authed user has bookmarked an org
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, lt, or, desc } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { bookmarks, organizations } from '@opengive/db/schema';

// ---------------------------------------------------------------------------
// Cursor helpers
// ---------------------------------------------------------------------------

function encodeBookmarkCursor(id: string, createdAt: string): string {
  return Buffer.from(`${createdAt}|${id}`).toString('base64url');
}

function decodeBookmarkCursor(cursor: string): { id: string; createdAt: string } {
  const raw = Buffer.from(cursor, 'base64url').toString('utf-8');
  const sep = raw.indexOf('|');
  if (sep === -1) throw new Error('Invalid bookmark cursor');
  return { createdAt: raw.slice(0, sep), id: raw.slice(sep + 1) };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const bookmarksRouter = router({
  /**
   * List the authenticated user's bookmarks, joined with organization name,
   * slug, countryCode, and sector. Returns cursor-paginated results ordered
   * by createdAt DESC.
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

      const conditions = [eq(bookmarks.userId, ctx.userId)];

      if (input.cursor) {
        const decoded = decodeBookmarkCursor(input.cursor);
        conditions.push(
          or(
            lt(bookmarks.createdAt, new Date(decoded.createdAt)),
            and(
              eq(bookmarks.createdAt, new Date(decoded.createdAt)),
              lt(bookmarks.id, decoded.id),
            ),
          ) as ReturnType<typeof eq>,
        );
      }

      const rows = await ctx.db
        .select({
          id: bookmarks.id,
          organizationId: bookmarks.organizationId,
          notes: bookmarks.notes,
          createdAt: bookmarks.createdAt,
          orgName: organizations.name,
          orgSlug: organizations.slug,
          orgCountryCode: organizations.countryCode,
          orgSector: organizations.sector,
        })
        .from(bookmarks)
        .innerJoin(organizations, eq(bookmarks.organizationId, organizations.id))
        .where(and(...conditions))
        .orderBy(desc(bookmarks.createdAt), desc(bookmarks.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const lastItem = items[items.length - 1];
      const nextCursor =
        hasMore && lastItem?.createdAt
          ? encodeBookmarkCursor(lastItem.id, lastItem.createdAt.toISOString())
          : null;

      return { items, nextCursor };
    }),

  /**
   * Add a bookmark for the authenticated user.
   * Silently succeeds if the bookmark already exists.
   */
  add: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        notes: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(bookmarks)
        .values({
          userId: ctx.userId,
          organizationId: input.organizationId,
          notes: input.notes ?? null,
        })
        .onConflictDoNothing()
        .returning();

      return row ?? null;
    }),

  /**
   * Remove a bookmark for the authenticated user by organizationId.
   * Throws NOT_FOUND when no matching bookmark exists.
   */
  remove: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db
        .delete(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, ctx.userId),
            eq(bookmarks.organizationId, input.organizationId),
          ),
        )
        .returning({ id: bookmarks.id });

      if (deleted.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bookmark not found' });
      }

      return { success: true };
    }),

  /**
   * Update the notes field on an existing bookmark.
   * Throws NOT_FOUND when no matching bookmark exists.
   */
  updateNotes: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        notes: z.string().max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db
        .update(bookmarks)
        .set({ notes: input.notes })
        .where(
          and(
            eq(bookmarks.userId, ctx.userId),
            eq(bookmarks.organizationId, input.organizationId),
          ),
        )
        .returning();

      if (updated.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bookmark not found' });
      }

      return updated[0];
    }),

  /**
   * Check whether the authenticated user has bookmarked a given organization.
   * Returns { bookmarked: boolean, notes?: string | null }.
   */
  isBookmarked: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({ id: bookmarks.id, notes: bookmarks.notes })
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, ctx.userId),
            eq(bookmarks.organizationId, input.organizationId),
          ),
        )
        .limit(1);

      if (rows.length === 0) {
        return { bookmarked: false, notes: null };
      }

      return { bookmarked: true, notes: rows[0]!.notes };
    }),
});

export type BookmarksRouter = typeof bookmarksRouter;
