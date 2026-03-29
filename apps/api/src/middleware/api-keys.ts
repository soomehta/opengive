/**
 * API key management middleware and key-generation helpers.
 *
 * Key format:   og_live_<32 hex chars>  (64 printable characters total)
 * Storage:      SHA-256 digest of the raw key stored in user_profiles.api_key_hash
 *               The raw key is NEVER persisted — it is returned once at creation
 *               and must be saved by the caller immediately.
 *
 * Validation flow:
 *   1. Read `X-API-Key` request header.
 *   2. SHA-256 hash the raw value.
 *   3. Look up the hash in user_profiles.
 *   4. Attach the profile row to `c.var.apiUser` if found.
 *   5. Return 401 when the key does not match any profile.
 *
 * The middleware is designed to be composed on routes that require
 * authentication (e.g. POST /v1/api-keys).  Public read-only routes use the
 * rate-limit middleware alone; the rate limiter already promotes callers that
 * supply a valid key to the higher tier.
 */

import { createHash, randomBytes } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { eq } from 'drizzle-orm';
import { createDb } from '@opengive/db/client';
import { userProfiles } from '@opengive/db';

// ---------------------------------------------------------------------------
// Re-exported types
// ---------------------------------------------------------------------------

/** Subset of user_profiles columns exposed as request context. */
export interface ApiUser {
  id: string;
  displayName: string | null;
  role: 'viewer' | 'analyst' | 'admin';
}

// ---------------------------------------------------------------------------
// Crypto helpers
// ---------------------------------------------------------------------------

/**
 * Returns the SHA-256 hex digest of a string.
 * Identical to the function in rate-limit.ts — kept local to avoid coupling.
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Generates a new raw API key in the form `og_live_<32-hex-bytes>`.
 *
 * The prefix makes keys easy to identify in logs/secret scanners.
 * 32 random bytes = 256 bits of entropy, well above brute-force threshold.
 */
export function generateApiKey(): string {
  const hex = randomBytes(32).toString('hex'); // 64 chars
  return `og_live_${hex}`;
}

// ---------------------------------------------------------------------------
// DB helper (mirrors index.ts pattern)
// ---------------------------------------------------------------------------

function getDb() {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL environment variable is not set');
  return createDb(url);
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

/**
 * Returns a Hono middleware that enforces API key authentication.
 *
 * On success the resolved user is attached to `c.var.apiUser`.
 * On failure a 401 response is returned with the standard error envelope.
 *
 * Usage:
 *   app.use('/v1/api-keys', requireApiKey());
 */
export function requireApiKey(): MiddlewareHandler {
  return async (c: Context, next) => {
    const rawKey = c.req.header('x-api-key')?.trim();

    if (!rawKey) {
      return c.json(
        {
          error: {
            code: 'MISSING_API_KEY',
            message: 'This endpoint requires authentication. Provide your API key via the X-API-Key header.',
          },
        },
        401,
      );
    }

    const keyHash = sha256Hex(rawKey);

    try {
      const db = getDb();
      const rows = await db
        .select({
          id: userProfiles.id,
          displayName: userProfiles.displayName,
          role: userProfiles.role,
        })
        .from(userProfiles)
        .where(eq(userProfiles.apiKeyHash, keyHash))
        .limit(1);

      const profile = rows[0];

      if (!profile) {
        return c.json(
          {
            error: {
              code: 'INVALID_API_KEY',
              message: 'The provided API key is invalid or has been revoked.',
            },
          },
          401,
        );
      }

      // Attach resolved user to request context for downstream handlers
      c.set('apiUser', {
        id: profile.id,
        displayName: profile.displayName,
        role: profile.role ?? 'viewer',
      } satisfies ApiUser);

      return next();
    } catch (err) {
      return c.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: err instanceof Error ? err.message : 'Unexpected error during authentication',
          },
        },
        500,
      );
    }
  };
}
