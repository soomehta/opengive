/**
 * Server-side tRPC caller factory.
 *
 * Use this in Server Components and Next.js Route Handlers to call tRPC
 * procedures without going through the HTTP layer.  The caller bypasses
 * serialisation/deserialisation, so procedure results are returned as their
 * native TypeScript types.
 *
 * Usage in a Server Component:
 *
 *   import { createServerCaller } from '@/lib/trpc-server';
 *
 *   const trpc = await createServerCaller();
 *   const org = await trpc.organizations.getBySlug({ slug: 'american-red-cross' });
 *
 * IMPORTANT: Do NOT share a single caller instance across concurrent requests.
 * Each request must get its own context so auth state is correctly isolated.
 */

import { appRouter } from '../server/routers/_app';
import { createContext, createCallerFactory } from '../server/trpc';

// Build the caller factory once at module load time — this is safe because the
// factory itself is stateless (it just holds a reference to the router).
const callerFactory = createCallerFactory(appRouter);

/**
 * Returns a new tRPC caller bound to a fresh context for the current request.
 * Must be called per-request — never stored as a module-level singleton.
 */
export async function createServerCaller() {
  const ctx = await createContext();
  return callerFactory(ctx);
}
