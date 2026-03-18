-- ===========================================================
-- Provider Online Readiness
-- Created: 2026-03-17
-- Purpose:
-- 1) Keep only real partners linked to auth users with emails
-- 2) Enable provider profile management (avatar, location, categories)
-- 3) Secure partner/taxonomy/specialization access with RLS
-- 4) Ensure map RPC returns only map-ready online partners
-- ===========================================================

-- -----------------------------------------------------------
-- 1) Data integrity + cleanup of mock/orphan partner rows
-- -----------------------------------------------------------
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.partners
  ALTER COLUMN is_online SET DEFAULT false;

ALTER TABLE public.partners
  ALTER COLUMN user_type SET DEFAULT 'provider';

-- Remove partner rows that are not tied to a real auth user with an email.
DELETE FROM public.partners p
WHERE NOT EXISTS (
  SELECT 1
  FROM auth.users u
  WHERE u.id = p.id
    AND u.email IS NOT NULL
    AND LENGTH(TRIM(u.email)) > 0
);

-- Keep specializations clean if legacy rows ever bypassed FK.
DELETE FROM public.partner_specializations ps
WHERE NOT EXISTS (
  SELECT 1
  FROM public.partners p
  WHERE p.id = ps.partner_id
);

-- Enforce linkage to auth.users now that legacy mock rows are removed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partners_id_auth_users_fkey'
      AND conrelid = 'public.partners'::regclass
  ) THEN
    ALTER TABLE public.partners
      ADD CONSTRAINT partners_id_auth_users_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_partners_location_gist
  ON public.partners USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_partners_map_ready
  ON public.partners (is_online, service_category)
  WHERE location IS NOT NULL;

-- -----------------------------------------------------------
-- 2) RLS policies
-- -----------------------------------------------------------
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_specializations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'partners'
      AND policyname = 'Authenticated users can read partners'
  ) THEN
    CREATE POLICY "Authenticated users can read partners"
      ON public.partners
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'partners'
      AND policyname = 'Partners can insert own profile'
  ) THEN
    CREATE POLICY "Partners can insert own profile"
      ON public.partners
      FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'partners'
      AND policyname = 'Partners can update own profile v2'
  ) THEN
    CREATE POLICY "Partners can update own profile v2"
      ON public.partners
      FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'partner_specializations'
      AND policyname = 'Authenticated users can read partner specializations'
  ) THEN
    CREATE POLICY "Authenticated users can read partner specializations"
      ON public.partner_specializations
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'partner_specializations'
      AND policyname = 'Partners can insert own specializations'
  ) THEN
    CREATE POLICY "Partners can insert own specializations"
      ON public.partner_specializations
      FOR INSERT
      WITH CHECK (auth.uid() = partner_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'partner_specializations'
      AND policyname = 'Partners can update own specializations'
  ) THEN
    CREATE POLICY "Partners can update own specializations"
      ON public.partner_specializations
      FOR UPDATE
      USING (auth.uid() = partner_id)
      WITH CHECK (auth.uid() = partner_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'partner_specializations'
      AND policyname = 'Partners can delete own specializations'
  ) THEN
    CREATE POLICY "Partners can delete own specializations"
      ON public.partner_specializations
      FOR DELETE
      USING (auth.uid() = partner_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'domains'
      AND policyname = 'Public can read domains'
  ) THEN
    CREATE POLICY "Public can read domains"
      ON public.domains
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assets'
      AND policyname = 'Public can read assets'
  ) THEN
    CREATE POLICY "Public can read assets"
      ON public.assets
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'service_types'
      AND policyname = 'Public can read service types'
  ) THEN
    CREATE POLICY "Public can read service types"
      ON public.service_types
      FOR SELECT
      USING (true);
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_specializations_unique
  ON public.partner_specializations (
    partner_id,
    COALESCE(domain_slug, ''),
    COALESCE(asset_slug, ''),
    COALESCE(service_type_slug, '')
  );

-- -----------------------------------------------------------
-- 3) Storage bucket for provider avatars
-- -----------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'partner-avatars',
  'partner-avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public can read partner avatars'
  ) THEN
    CREATE POLICY "Public can read partner avatars"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'partner-avatars');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Partners can upload own avatars'
  ) THEN
    CREATE POLICY "Partners can upload own avatars"
      ON storage.objects
      FOR INSERT
      WITH CHECK (
        bucket_id = 'partner-avatars'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Partners can update own avatars'
  ) THEN
    CREATE POLICY "Partners can update own avatars"
      ON storage.objects
      FOR UPDATE
      USING (
        bucket_id = 'partner-avatars'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'partner-avatars'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Partners can delete own avatars'
  ) THEN
    CREATE POLICY "Partners can delete own avatars"
      ON storage.objects
      FOR DELETE
      USING (
        bucket_id = 'partner-avatars'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END;
$$;

-- -----------------------------------------------------------
-- 4) Provider helper RPCs
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_my_partner_location(
  input_lat DOUBLE PRECISION,
  input_long DOUBLE PRECISION
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  current_uid UUID := auth.uid();
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.partners
  SET
    location = ST_SetSRID(ST_MakePoint(input_long, input_lat), 4326)::geography,
    updated_at = NOW()
  WHERE id = current_uid;

  IF NOT FOUND THEN
    INSERT INTO public.partners (id, full_name, user_type, is_online, location, updated_at)
    VALUES (
      current_uid,
      'Prestador',
      'provider',
      false,
      ST_SetSRID(ST_MakePoint(input_long, input_lat), 4326)::geography,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      location = EXCLUDED.location,
      updated_at = NOW();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_my_partner_specializations(
  input_specs JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_uid UUID := auth.uid();
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.partners WHERE id = current_uid) THEN
    INSERT INTO public.partners (id, full_name, user_type, is_online)
    VALUES (current_uid, 'Prestador', 'provider', false)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  DELETE FROM public.partner_specializations
  WHERE partner_id = current_uid;

  IF input_specs IS NULL OR jsonb_typeof(input_specs) <> 'array' THEN
    RETURN;
  END IF;

  INSERT INTO public.partner_specializations (
    id,
    partner_id,
    domain_slug,
    asset_slug,
    service_type_slug
  )
  SELECT
    gen_random_uuid(),
    current_uid,
    parsed.domain_slug,
    parsed.asset_slug,
    parsed.service_type_slug
  FROM (
    SELECT DISTINCT
      NULLIF(TRIM(elem->>'domain_slug'), '') AS domain_slug,
      NULLIF(TRIM(elem->>'asset_slug'), '') AS asset_slug,
      NULLIF(TRIM(elem->>'service_type_slug'), '') AS service_type_slug
    FROM jsonb_array_elements(input_specs) elem
  ) parsed
  LEFT JOIN public.domains d
    ON parsed.domain_slug IS NULL OR d.slug = parsed.domain_slug
  LEFT JOIN public.assets a
    ON parsed.asset_slug IS NULL OR a.slug = parsed.asset_slug
  LEFT JOIN public.service_types st
    ON parsed.service_type_slug IS NULL OR st.slug = parsed.service_type_slug
  WHERE (parsed.domain_slug IS NULL OR d.slug IS NOT NULL)
    AND (parsed.asset_slug IS NULL OR a.slug IS NOT NULL)
    AND (parsed.service_type_slug IS NULL OR st.slug IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_partner_location(DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_partner_location(DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

REVOKE ALL ON FUNCTION public.upsert_my_partner_specializations(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_my_partner_specializations(JSONB) TO authenticated;

-- -----------------------------------------------------------
-- 5) Map RPC hardened to return only map-ready online partners
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_map_partners_v2(
  input_lat DOUBLE PRECISION,
  input_long DOUBLE PRECISION,
  radius_km INTEGER DEFAULT 500,
  max_limit INTEGER DEFAULT 1000
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  avatar_url TEXT,
  service_category TEXT,
  rating NUMERIC,
  lat DOUBLE PRECISION,
  long DOUBLE PRECISION,
  is_online BOOLEAN,
  dist_km DOUBLE PRECISION,
  hourly_rate NUMERIC,
  type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pa.id,
    COALESCE(pa.full_name, 'Prestador') AS full_name,
    COALESCE(pa.avatar_url, '') AS avatar_url,
    COALESCE(pa.service_category, 'Geral') AS service_category,
    COALESCE(pa.rating, 5.0) AS rating,
    ST_Y(pa.location::geometry) AS lat,
    ST_X(pa.location::geometry) AS long,
    pa.is_online,
    (
      ST_Distance(
        pa.location::geography,
        ST_SetSRID(ST_MakePoint(input_long, input_lat), 4326)::geography
      ) / 1000.0
    ) AS dist_km,
    pa.base_fee AS hourly_rate,
    COALESCE(pa.type, 'MOBILE')::TEXT AS type
  FROM public.partners pa
  WHERE pa.location IS NOT NULL
    AND COALESCE(pa.is_online, false) = true
    AND ST_DWithin(
      pa.location::geography,
      ST_SetSRID(ST_MakePoint(input_long, input_lat), 4326)::geography,
      radius_km * 1000
    )
  ORDER BY dist_km ASC
  LIMIT max_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_map_partners_v2(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO anon, authenticated;
