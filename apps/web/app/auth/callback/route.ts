import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

/**
 * OAuth callback handler.
 * Supabase redirects here after Google / GitHub OAuth with a temporary code.
 * We exchange the code for a session, then redirect the user onward.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/explore';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
}
