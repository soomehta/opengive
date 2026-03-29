/**
 * In-memory sliding-window rate limiter for the Hono public API.
 *
 * Limits:
 *   - Anonymous callers:      100 requests / 60 seconds
 *   - Authenticated callers:  1 000 requests / 60 seconds
 *     (authenticated = request includes a valid `X-API-Key` header)
 *
 * The key used for bucketing is:
 *   - Authenticated: the SHA-256 hex digest of the raw API key value
 *   - Anonymous:     the client IP extracted from `X-Forwarded-For` (first hop)
 *     or `CF-Connecting-IP`, falling back to a synthetic "anon" key.
 *
 * A sliding window is approximated with a two-bucket approach:
 *   - `current` bucket accumulates hits for the ongoing window.
 *   - `previous` bucket holds the count from the prior window.
 *   - The estimated count is: previous * (remaining fraction) + current.
 *
 * This is O(1) memory per unique key vs. O(N) for a true sliding log.
 *
 * NOTE: This implementation is single-process and in-memory.  For multi-
 * replica deployments replace with a Redis-backed counter (e.g. ioredis +
 * INCR / EXPIREAT) or a Cloudflare Workers KV / Durable Object solution.
 */

import type { Context, MiddlewareHandler } from 'hono';
import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Duration of each rate-limit window in milliseconds. */
const WINDOW_MS = 60_000;

/** Maximum requests per window for anonymous callers. */
const ANON_LIMIT = 100;

/** Maximum requests per window for authenticated callers. */
const AUTH_LIMIT = 1_000;

// ---------------------------------------------------------------------------
// Internal sliding-window state
// ---------------------------------------------------------------------------

interface WindowBucket {
  /** Number of requests recorded in this window. */
  count: number;
  /** Unix timestamp (ms) when this window expires. */
  expiresAt: number;
}

interface WindowState {
  current: WindowBucket;
  previous: WindowBucket;
}

/**
 * Global store keyed by the hashed client identifier.
 * Entries are lazily evicted on the next request for the same key once both
 * their current and previous windows are fully expired.
 */
const store = new Map<string, WindowState>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the SHA-256 hex digest of a string.
 * Used to avoid storing raw API keys in memory.
 */
function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Extracts the best-effort client IP from standard proxy headers.
 * Returns null when no IP can be determined.
 */
function getClientIp(c: Context): string | null {
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const firstIp = xff.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }
  const cf = c.req.header('cf-connecting-ip');
  if (cf) return cf.trim();

  return null;
}

/**
 * Returns the rate-limit bucket key and the applicable limit for the request.
 *
 * When an `X-API-Key` header is present the key is hashed and the higher
 * authenticated limit applies.  Otherwise the client IP (or a fallback) is
 * used with the lower anonymous limit.
 */
function resolveKey(c: Context): { key: string; limit: number } {
  const apiKey = c.req.header('x-api-key');

  if (apiKey && apiKey.trim().length > 0) {
    return {
      key: `auth:${sha256(apiKey.trim())}`,
      limit: AUTH_LIMIT,
    };
  }

  const ip = getClientIp(c) ?? 'anon';
  return {
    key: `anon:${ip}`,
    limit: ANON_LIMIT,
  };
}

/**
 * Returns the current sliding-window hit estimate for a key + limit pair.
 * Mutates the store entry in place and returns the updated estimated count.
 */
function incrementAndEstimate(key: string, limit: number): number {
  const now = Date.now();
  const windowEnd = Math.ceil(now / WINDOW_MS) * WINDOW_MS;
  const windowStart = windowEnd - WINDOW_MS;

  let state = store.get(key);

  if (!state) {
    // First request from this key
    state = {
      previous: { count: 0, expiresAt: windowStart },
      current: { count: 0, expiresAt: windowEnd },
    };
    store.set(key, state);
  }

  // Rotate windows when the current window has expired
  if (now >= state.current.expiresAt) {
    if (now < state.current.expiresAt + WINDOW_MS) {
      // The previous window becomes the window that just rolled over
      state.previous = { ...state.current };
    } else {
      // More than one full window has passed — reset both
      state.previous = { count: 0, expiresAt: windowStart };
    }
    state.current = { count: 0, expiresAt: windowEnd };
  }

  // Increment current window
  state.current.count += 1;

  // Sliding-window estimate:
  //   elapsed fraction within the current window
  const elapsed = now - (state.current.expiresAt - WINDOW_MS);
  const fraction = Math.max(0, Math.min(1, elapsed / WINDOW_MS));

  // Previous window contributes its decaying tail
  const estimated =
    state.previous.count * (1 - fraction) + state.current.count;

  return estimated;
}

// ---------------------------------------------------------------------------
// Periodic GC — evict fully-expired entries every 5 minutes
// ---------------------------------------------------------------------------

setInterval(() => {
  const now = Date.now();
  for (const [key, state] of store.entries()) {
    // Safe to evict when both windows are more than one full window past expiry
    if (
      now > state.current.expiresAt + WINDOW_MS &&
      now > state.previous.expiresAt + WINDOW_MS
    ) {
      store.delete(key);
    }
  }
}, 5 * 60_000).unref();

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

/**
 * Returns a Hono middleware handler that enforces per-key rate limits.
 *
 * On rejection the response is:
 *   HTTP 429  { error: { code: "RATE_LIMITED", message: "..." } }
 *   Retry-After: <seconds until window resets>
 *   X-RateLimit-Limit: <limit>
 *   X-RateLimit-Remaining: <remaining>
 *   X-RateLimit-Reset: <Unix timestamp of window end>
 */
export function rateLimitMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const { key, limit } = resolveKey(c);
    const estimated = incrementAndEstimate(key, limit);

    const state = store.get(key)!;
    const resetAt = state.current.expiresAt;
    const remaining = Math.max(0, Math.floor(limit - estimated));
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);

    // Always attach informational headers
    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.floor(resetAt / 1000)));

    if (estimated > limit) {
      c.header('Retry-After', String(Math.max(1, retryAfter)));
      return c.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: `Rate limit exceeded. Try again in ${Math.max(1, retryAfter)} seconds.`,
          },
        },
        429,
      );
    }

    return next();
  };
}
