import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { createServerClient } from '@supabase/ssr';
import { createDb } from '@opengive/db/client';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * Options accepted when constructing a tRPC context from an incoming request.
 * When `req` is provided the Supabase JWT is extracted and verified so that
 * `userId` and `userRole` are populated for authenticated callers.
 */
export interface CreateContextOptions {
  /**
   * The raw `Request` object from the Next.js App Router handler.
   * Pass this to enable JWT authentication. Omit for test/server-side calls
   * where you want to set userId/userRole directly.
   */
  req?: Request;
  /** Override userId directly (useful in tests or server-side calls). */
  userId?: string | null;
  /** Override userRole directly (useful in tests or server-side calls). */
  userRole?: string | null;
}

export async function createContext(opts: CreateContextOptions = {}) {
  const db = createDb(process.env.DATABASE_URL!);

  let userId: string | null = opts.userId ?? null;
  let userRole: string | null = opts.userRole ?? null;

  // When a real HTTP request is available, attempt to verify the Supabase JWT.
  // `createServerClient` from @supabase/ssr reads the auth cookies set by the
  // Supabase Auth helpers. If the session is valid, `getUser()` returns the
  // authenticated user and we can pull the role from `user_metadata`.
  if (opts.req && !userId) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseAnonKey) {
        const cookieHeader = opts.req.headers.get('cookie') ?? '';

        // Parse the raw Cookie header into the key/value pairs that
        // @supabase/ssr's `cookies` adapter expects.
        const cookieStore = parseCookies(cookieHeader);

        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
          cookies: {
            getAll() {
              return cookieStore;
            },
            // tRPC context is read-only with respect to cookie mutation — the
            // response cookies are managed by Next.js middleware.
            setAll() {
              // No-op in request context
            },
          },
        });

        const { data } = await supabase.auth.getUser();
        if (data.user) {
          userId = data.user.id;
          // Look up role from user_profiles table (not user_metadata which
          // users can modify themselves — privilege escalation risk).
          try {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('role')
              .eq('id', data.user.id)
              .single();
            userRole = profile?.role ?? 'viewer';
          } catch {
            userRole = 'viewer';
          }
        }
      }
    } catch {
      // Auth failure is non-fatal for public procedures; protectedProcedure
      // will throw UNAUTHORIZED if userId is still null.
    }
  }

  return {
    db,
    userId,
    userRole,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

// ---------------------------------------------------------------------------
// tRPC initialisation
// ---------------------------------------------------------------------------

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Expose the standardised error envelope alongside tRPC's own fields
        // so the Hono public API adapter can forward it verbatim.
        apiError: {
          code: shape.data.code,
          message: error.message,
        },
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------

export const router = t.router;

/** Available to all callers — no auth required. */
export const publicProcedure = t.procedure;

/**
 * Requires an authenticated Supabase session.
 * Throws UNAUTHORIZED when `ctx.userId` is null.
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      // Narrow the type so downstream code knows userId is non-null.
      userId: ctx.userId,
    },
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parses a raw `Cookie` header string into the array format expected by
 * `@supabase/ssr`'s `cookies.getAll()` callback.
 *
 * Example input:  "sb-access-token=xxx; sb-refresh-token=yyy"
 * Example output: [{ name: "sb-access-token", value: "xxx" }, …]
 */
function parseCookies(
  cookieHeader: string,
): Array<{ name: string; value: string }> {
  if (!cookieHeader.trim()) return [];
  return cookieHeader.split(';').flatMap((pair) => {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) return [];
    const name = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (!name) return [];
    return [{ name, value }];
  });
}
