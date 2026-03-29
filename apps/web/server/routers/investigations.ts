/**
 * tRPC router — investigations
 *
 * Exposes:
 *   investigations.list     — protectedProcedure, list current user's investigations
 *   investigations.create   — protectedProcedure, create a new investigation
 *   investigations.update   — protectedProcedure, update an investigation (owner only)
 *   investigations.delete   — protectedProcedure, delete an investigation (owner only)
 *   investigations.getById  — publicProcedure for public investigations;
 *                             protectedProcedure for private (owner only)
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc';

// ---------------------------------------------------------------------------
// Shared Zod schemas
// ---------------------------------------------------------------------------

const investigationPayload = z.object({
  title: z.string().min(1).max(200),
  organizationIds: z.array(z.string()).max(50),
  queryState: z.record(z.unknown()).default({}),
  isPublic: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// In-memory store (placeholder until DB queries are wired up)
// Replace the InvestigationStore references with @opengive/db calls in S7.
// ---------------------------------------------------------------------------

export interface StoredInvestigation {
  id: string;
  userId: string;
  title: string;
  organizationIds: string[];
  queryState: Record<string, unknown>;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Module-level ephemeral store — replace with DB queries in Sprint 7 */
const INVESTIGATIONS_STORE = new Map<string, StoredInvestigation>();

function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const investigationsRouter = router({
  /**
   * List all investigations belonging to the authenticated user.
   * Returns them ordered by updatedAt DESC.
   */
  list: protectedProcedure
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userInvs = Array.from(INVESTIGATIONS_STORE.values())
        .filter((inv) => inv.userId === ctx.userId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

      // Cursor-based pagination
      const startIdx = input.cursor
        ? userInvs.findIndex((inv) => inv.id === input.cursor) + 1
        : 0;

      const items = userInvs.slice(startIdx, startIdx + input.limit);
      const nextCursor = items.length === input.limit ? items[items.length - 1]?.id ?? null : null;

      return { items, nextCursor };
    }),

  /**
   * Create a new investigation for the authenticated user.
   */
  create: protectedProcedure
    .input(investigationPayload)
    .mutation(async ({ ctx, input }) => {
      const id = generateId();
      const ts = now();
      const inv: StoredInvestigation = {
        id,
        userId: ctx.userId,
        title: input.title,
        organizationIds: input.organizationIds,
        queryState: input.queryState as Record<string, unknown>,
        isPublic: input.isPublic,
        createdAt: ts,
        updatedAt: ts,
      };
      INVESTIGATIONS_STORE.set(id, inv);
      return inv;
    }),

  /**
   * Update an existing investigation.
   * Only the owner may update. Throws NOT_FOUND / FORBIDDEN as appropriate.
   */
  update: protectedProcedure
    .input(investigationPayload.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = INVESTIGATIONS_STORE.get(input.id);
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Investigation not found' });
      }
      if (existing.userId !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your investigation' });
      }
      const updated: StoredInvestigation = {
        ...existing,
        title: input.title,
        organizationIds: input.organizationIds,
        queryState: input.queryState as Record<string, unknown>,
        isPublic: input.isPublic,
        updatedAt: now(),
      };
      INVESTIGATIONS_STORE.set(input.id, updated);
      return updated;
    }),

  /**
   * Delete an investigation. Only the owner may delete.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = INVESTIGATIONS_STORE.get(input.id);
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Investigation not found' });
      }
      if (existing.userId !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your investigation' });
      }
      INVESTIGATIONS_STORE.delete(input.id);
      return { success: true };
    }),

  /**
   * Fetch a single investigation by id.
   * - Public investigations are accessible to all callers.
   * - Private investigations require the caller to be the owner.
   */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const inv = INVESTIGATIONS_STORE.get(input.id);
      if (!inv) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Investigation not found' });
      }
      if (!inv.isPublic) {
        // Private — require ownership
        if (!ctx.userId || ctx.userId !== inv.userId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'This investigation is private' });
        }
      }
      return inv;
    }),
});

export type InvestigationsRouter = typeof investigationsRouter;
