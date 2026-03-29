import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client.
 * Use this in Client Components (`'use client'`).
 * A new instance is created per call — memoize in state if needed.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
