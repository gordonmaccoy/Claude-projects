-- Taco Map account foundation, 4 October 2026.
-- Run in the Taco Map Supabase SQL Editor as the trusted postgres owner.
-- This adds owner-private profiles only. Google/Kakao provider setup is separate.
-- Does not change restaurant permissions or add reviews/check-ins/photo uploads.
-- No email, provider tokens or permission roles are stored in public.profiles.
BEGIN;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Taco explorer'
    CONSTRAINT profiles_display_name_length
      CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 80
             AND char_length(display_name) <= 80),
  avatar_url TEXT
    CONSTRAINT profiles_avatar_url_format
      CHECK (avatar_url IS NULL OR
             (char_length(avatar_url) <= 2048
              AND avatar_url ~ '^https://[^[:space:]]+$')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A rerun is safe for this exact first-phase schema. Stop rather than silently
-- replace differently named columns or unrelated access policies. This guard
-- does not verify every existing type/constraint/trigger; review pre-existing tables.
DO $$
BEGIN
  IF (SELECT array_agg(a.attname::text ORDER BY a.attname)
      FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = 'public.profiles'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped)
     <> ARRAY['avatar_url', 'created_at', 'display_name', 'id', 'updated_at']::text[]
  THEN
    RAISE EXCEPTION 'Existing profiles schema differs. Review it before applying Taco Map account SQL.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy p
    WHERE p.polrelid = 'public.profiles'::regclass
      AND p.polname NOT IN ('profiles_owner_read', 'profiles_owner_update')
  ) THEN
    RAISE EXCEPTION 'Existing profiles policies differ. Review them before applying Taco Map account SQL.';
  END IF;
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Supabase public schema defaults can grant too much. Reset both table and
-- column grants. Client users can only read their row and edit cosmetic fields.
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL (id, display_name, avatar_url, created_at, updated_at)
  ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, display_name, avatar_url, created_at, updated_at)
  ON TABLE public.profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url)
  ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

DROP POLICY IF EXISTS profiles_owner_read ON public.profiles;
CREATE POLICY profiles_owner_read ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = id);

DROP POLICY IF EXISTS profiles_owner_update ON public.profiles;
CREATE POLICY profiles_owner_update ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = id);

CREATE OR REPLACE FUNCTION public.taco_profiles_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.taco_profiles_set_updated_at()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS taco_profiles_updated_at ON public.profiles;
CREATE TRIGGER taco_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.taco_profiles_set_updated_at();

-- Metadata is user-controlled. Ignore it entirely here: no role/admin flags,
-- no assumed display-name/avatar format and no email requirement. This lets
-- Google/Kakao users with missing or malformed metadata create an account.
CREATE OR REPLACE FUNCTION public.taco_create_account_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, 'Taco explorer', NULL)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.taco_create_account_profile() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.taco_create_account_profile()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS taco_account_profile_created ON auth.users;
CREATE TRIGGER taco_account_profile_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.taco_create_account_profile();

-- Existing accounts receive the same harmless defaults. Never overwrite a
-- member's chosen display name or avatar on reruns.
INSERT INTO public.profiles (id, display_name, avatar_url)
SELECT u.id, 'Taco explorer', NULL FROM auth.users u
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Safe administrator summary only; no user identifiers or emails printed.
SELECT count(*) AS account_profiles_created FROM public.profiles;
