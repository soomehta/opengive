-- Migration 00008: Auto-create user_profiles on signup + fix RLS for onboarding
--
-- Problem: When a new user signs up via Supabase Auth, no row exists in
-- user_profiles. The RLS policy "Users own profiles" (auth.uid() = id)
-- blocks the INSERT because there's no explicit INSERT policy, and the
-- app has no code to create the profile row.
--
-- Fix:
-- 1. Database trigger on auth.users INSERT that auto-creates the profile
-- 2. Explicit INSERT policy so authenticated users can create their own profile

-- =========================================================================
-- 1. Auto-create user_profiles row on signup
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    'viewer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- 2. Fix RLS: add explicit INSERT policy for user_profiles
-- =========================================================================

-- The existing "Users own profiles" policy is ALL (SELECT+INSERT+UPDATE+DELETE)
-- with qual (auth.uid() = id). This SHOULD allow inserts where the user sets
-- id = their own auth.uid(). But to be safe and explicit, add a dedicated
-- INSERT policy:

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =========================================================================
-- 3. Also add a SELECT policy so authenticated users can read their profile
-- even before the trigger fires (edge case during the same transaction)
-- =========================================================================

DROP POLICY IF EXISTS "Authenticated users can read own profile" ON user_profiles;
CREATE POLICY "Authenticated users can read own profile" ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- =========================================================================
-- 4. Backfill: create profiles for any existing auth.users that don't have one
-- =========================================================================

INSERT INTO public.user_profiles (id, display_name, role)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email::text, '@', 1)),
  'viewer'
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
