-- ===========================================================
-- Category Compatibility for Provider Feed
-- Created: 2026-03-18
-- Purpose:
-- 1) Normalize legacy provider/request categories to domain categories
-- 2) Prevent empty provider feed caused by category mismatch (auto vs mobilidade, etc.)
-- ===========================================================

CREATE OR REPLACE FUNCTION public.normalize_service_domain(input_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT := lower(trim(COALESCE(input_value, '')));
BEGIN
  IF normalized = '' THEN
    RETURN NULL;
  END IF;

  IF normalized IN ('mobilidade', 'auto', 'mecanica', 'mecânica', 'vehicle', 'veiculo', 'veículo', 'car') THEN
    RETURN 'mobilidade';
  END IF;

  IF normalized IN (
    'casa',
    'home',
    'residencial',
    'hvac',
    'plumbing',
    'gardening',
    'cleaning',
    'beauty',
    'carpentry',
    'pest_control',
    'handyman',
    'electrical'
  ) THEN
    RETURN 'casa';
  END IF;

  IF normalized IN (
    'tecnologia',
    'technology',
    'tech',
    'electronics',
    'eletronicos',
    'eletrônicos',
    'informatica',
    'informática',
    'celular'
  ) THEN
    RETURN 'tecnologia';
  END IF;

  RETURN normalized;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_provider_open_requests(
  input_radius_km INTEGER DEFAULT 5,
  input_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  category TEXT,
  user_text TEXT,
  ai_result_json JSONB,
  asset_slug TEXT,
  service_type_slug TEXT,
  issue_tags TEXT[],
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  address TEXT,
  neighborhood TEXT,
  city TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  dist_km DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  current_uid UUID := auth.uid();
  provider_row RECORD;
  provider_domain TEXT;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.location, p.is_online, p.service_category
  INTO provider_row
  FROM public.partners p
  WHERE p.id = current_uid;

  IF provider_row IS NULL OR provider_row.location IS NULL THEN
    RETURN;
  END IF;

  IF COALESCE(provider_row.is_online, false) = false THEN
    RETURN;
  END IF;

  provider_domain := public.normalize_service_domain(provider_row.service_category);

  RETURN QUERY
  SELECT
    r.id,
    r.category,
    r.user_text,
    r.ai_result_json,
    r.asset_slug,
    r.service_type_slug,
    r.issue_tags,
    r.lat,
    r.lng,
    r.address,
    r.neighborhood,
    r.city,
    r.status,
    r.created_at,
    r.updated_at,
    r.expires_at,
    (
      ST_Distance(
        provider_row.location,
        ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326)::geography
      ) / 1000.0
    ) AS dist_km
  FROM public.requests r
  WHERE r.provider_id IS NULL
    AND r.status IN ('finding', 'offered')
    AND r.lat IS NOT NULL
    AND r.lng IS NOT NULL
    AND (r.expires_at IS NULL OR r.expires_at > NOW())
    AND (
      provider_domain IS NULL
      OR public.normalize_service_domain(r.category) = provider_domain
    )
    AND ST_DWithin(
      provider_row.location,
      ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326)::geography,
      input_radius_km * 1000
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.provider_offers po
      WHERE po.request_id = r.id
        AND po.provider_id = current_uid
        AND po.status IN ('offered', 'accepted', 'rejected', 'declined')
    )
  ORDER BY dist_km ASC, r.created_at DESC
  LIMIT GREATEST(input_limit, 1);
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_service_domain(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_service_domain(TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_provider_open_requests(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_provider_open_requests(INTEGER, INTEGER) TO authenticated;

