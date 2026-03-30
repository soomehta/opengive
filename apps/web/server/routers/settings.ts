/**
 * tRPC router — settings
 *
 * All procedures are protected (require authentication).
 *
 * Exposes:
 *   settings.getProfile    — fetch the current user's profile row
 *   settings.updateProfile — update displayName on user_profiles
 *   settings.generateApiKey — generate a random key, store its SHA-256 hash,
 *                             and return the raw (one-time) key to the caller
 *   settings.revokeApiKey  — set api_key_hash to null
 *   settings.hasApiKey     — return boolean indicating whether a key exists
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';
import { router, protectedProcedure } from '../trpc';
import { userProfiles } from '@opengive/db/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generates a URL-safe random API key in the format `og_<hex40>`. */
function generateRawApiKey(): string {
  return `og_${randomBytes(20).toString('hex')}`;
}

/** SHA-256 hashes a raw API key for storage. */
function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const settingsRouter = router({
  /**
   * Fetch the authenticated user's profile row.
   * Throws NOT_FOUND when the profile does not yet exist.
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: userProfiles.id,
        displayName: userProfiles.displayName,
        role: userProfiles.role,
        preferences: userProfiles.preferences,
        hasApiKey: userProfiles.apiKeyHash,
        createdAt: userProfiles.createdAt,
        updatedAt: userProfiles.updatedAt,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, ctx.userId))
      .limit(1);

    if (rows.length === 0) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User profile not found' });
    }

    const row = rows[0]!;
    // Never expose the hash to the client — return only a boolean.
    return {
      id: row.id,
      displayName: row.displayName,
      role: row.role,
      preferences: row.preferences,
      hasApiKey: row.hasApiKey !== null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }),

  /**
   * Update the display name on the user's profile.
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.displayName === undefined) {
        return { success: true };
      }

      const updated = await ctx.db
        .update(userProfiles)
        .set({
          displayName: input.displayName,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.id, ctx.userId))
        .returning({
          id: userProfiles.id,
          displayName: userProfiles.displayName,
        });

      if (updated.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User profile not found' });
      }

      return updated[0];
    }),

  /**
   * Generate a new API key for the authenticated user.
   *
   * Workflow:
   *   1. Generate a cryptographically random key (`og_<hex40>`).
   *   2. SHA-256 hash it and persist the hash in `api_key_hash`.
   *   3. Return the *raw* key to the caller — this is the only opportunity
   *      to retrieve it; it is never stored in plaintext.
   *
   * Any previously existing key is overwritten.
   */
  generateApiKey: protectedProcedure.mutation(async ({ ctx }) => {
    const rawKey = generateRawApiKey();
    const keyHash = hashApiKey(rawKey);

    const updated = await ctx.db
      .update(userProfiles)
      .set({ apiKeyHash: keyHash, updatedAt: new Date() })
      .where(eq(userProfiles.id, ctx.userId))
      .returning({ id: userProfiles.id });

    if (updated.length === 0) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User profile not found' });
    }

    // Return the raw key — the caller must store it; it is not recoverable.
    return { key: rawKey };
  }),

  /**
   * Revoke the authenticated user's API key by clearing `api_key_hash`.
   */
  revokeApiKey: protectedProcedure.mutation(async ({ ctx }) => {
    const updated = await ctx.db
      .update(userProfiles)
      .set({ apiKeyHash: null, updatedAt: new Date() })
      .where(eq(userProfiles.id, ctx.userId))
      .returning({ id: userProfiles.id });

    if (updated.length === 0) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User profile not found' });
    }

    return { success: true };
  }),

  /**
   * Returns whether the authenticated user has an active API key hash stored.
   */
  hasApiKey: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ apiKeyHash: userProfiles.apiKeyHash })
      .from(userProfiles)
      .where(eq(userProfiles.id, ctx.userId))
      .limit(1);

    return { hasApiKey: rows.length > 0 && rows[0]!.apiKeyHash !== null };
  }),
});

export type SettingsRouter = typeof settingsRouter;
