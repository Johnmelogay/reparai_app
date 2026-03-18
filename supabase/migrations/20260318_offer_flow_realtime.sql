-- ===========================================================
-- Offer Flow Realtime (Client <-> Provider)
-- Created: 2026-03-18
-- Purpose:
-- 1) Real provider offers (accept/reject) without mock trigger
-- 2) Provider feed filtered by 5km radius
-- 3) Client confirms one offer and opens chat immediately
-- ===========================================================

-- -----------------------------------------------------------
-- 1) provider_offers hardening
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offered',
  price NUMERIC(10, 2),
  estimated_time INTEGER,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.provider_offers
  ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS estimated_time INTEGER,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.provider_offers
  ALTER COLUMN status SET DEFAULT 'offered';

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_offers_request_provider_unique
  ON public.provider_offers (request_id, provider_id);

CREATE INDEX IF NOT EXISTS idx_provider_offers_request_status
  ON public.provider_offers (request_id, status);

CREATE INDEX IF NOT EXISTS idx_provider_offers_provider_status
  ON public.provider_offers (provider_id, status);

-- Keep updated_at synced for audit/realtime ordering.
CREATE OR REPLACE FUNCTION public.touch_provider_offers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_provider_offers_touch_updated_at ON public.provider_offers;
CREATE TRIGGER trg_provider_offers_touch_updated_at
BEFORE UPDATE ON public.provider_offers
FOR EACH ROW
EXECUTE FUNCTION public.touch_provider_offers_updated_at();

-- Ensure provider_offers emits realtime events.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'provider_offers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_offers;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

-- -----------------------------------------------------------
-- 2) Disable simulated bids (only real providers should respond)
-- -----------------------------------------------------------
DROP TRIGGER IF EXISTS trg_simulate_provider_bids ON public.requests;

-- -----------------------------------------------------------
-- 3) RLS for provider_offers
-- -----------------------------------------------------------
ALTER TABLE public.provider_offers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'provider_offers'
      AND policyname = 'Users can read own request offers'
  ) THEN
    CREATE POLICY "Users can read own request offers"
      ON public.provider_offers
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.requests r
          WHERE r.id = request_id
            AND (r.user_id = auth.uid() OR r.provider_id = auth.uid())
        )
        OR provider_id = auth.uid()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'provider_offers'
      AND policyname = 'Providers can insert own offers'
  ) THEN
    CREATE POLICY "Providers can insert own offers"
      ON public.provider_offers
      FOR INSERT
      WITH CHECK (provider_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'provider_offers'
      AND policyname = 'Providers can update own offers'
  ) THEN
    CREATE POLICY "Providers can update own offers"
      ON public.provider_offers
      FOR UPDATE
      USING (provider_id = auth.uid())
      WITH CHECK (provider_id = auth.uid());
  END IF;
END;
$$;

-- -----------------------------------------------------------
-- 4) Provider feed RPC (5km radius default)
-- -----------------------------------------------------------
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
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.location, p.is_online
  INTO provider_row
  FROM public.partners p
  WHERE p.id = current_uid;

  IF provider_row IS NULL OR provider_row.location IS NULL THEN
    RETURN;
  END IF;

  IF COALESCE(provider_row.is_online, false) = false THEN
    RETURN;
  END IF;

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

-- -----------------------------------------------------------
-- 5) Provider actions RPCs
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_provider_offer(
  p_request_id UUID,
  p_price NUMERIC DEFAULT NULL,
  p_estimated_time INTEGER DEFAULT NULL,
  p_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  current_uid UUID := auth.uid();
  offer_id UUID;
  request_row RECORD;
  provider_row RECORD;
  provider_distance_km DOUBLE PRECISION;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO provider_row
  FROM public.partners p
  WHERE p.id = current_uid;

  IF provider_row IS NULL THEN
    RAISE EXCEPTION 'Provider profile not found';
  END IF;

  IF COALESCE(provider_row.is_online, false) = false THEN
    RAISE EXCEPTION 'Provider must be online to submit offers';
  END IF;

  IF provider_row.location IS NULL THEN
    RAISE EXCEPTION 'Provider location is required';
  END IF;

  SELECT *
  INTO request_row
  FROM public.requests r
  WHERE r.id = p_request_id
    AND r.provider_id IS NULL
    AND r.status IN ('finding', 'offered')
    AND (r.expires_at IS NULL OR r.expires_at > NOW())
  FOR UPDATE;

  IF request_row IS NULL THEN
    RAISE EXCEPTION 'Request unavailable for offers';
  END IF;

  IF request_row.lat IS NULL OR request_row.lng IS NULL THEN
    RAISE EXCEPTION 'Request location is missing';
  END IF;

  provider_distance_km :=
    ST_Distance(
      provider_row.location::geography,
      ST_SetSRID(ST_MakePoint(request_row.lng, request_row.lat), 4326)::geography
    ) / 1000.0;

  IF provider_distance_km > 5 THEN
    RAISE EXCEPTION 'Request is outside provider dispatch radius';
  END IF;

  INSERT INTO public.provider_offers (
    request_id,
    provider_id,
    status,
    price,
    estimated_time,
    message,
    responded_at
  )
  VALUES (
    p_request_id,
    current_uid,
    'offered',
    COALESCE(p_price, provider_row.base_fee, 0),
    COALESCE(NULLIF(p_estimated_time, 0), 30),
    NULLIF(TRIM(COALESCE(p_message, '')), ''),
    NOW()
  )
  ON CONFLICT (request_id, provider_id)
  DO UPDATE
  SET
    status = 'offered',
    price = EXCLUDED.price,
    estimated_time = EXCLUDED.estimated_time,
    message = EXCLUDED.message,
    responded_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO offer_id;

  UPDATE public.requests
  SET
    status = CASE WHEN status = 'finding' THEN 'offered' ELSE status END,
    updated_at = NOW()
  WHERE id = p_request_id
    AND provider_id IS NULL;

  RETURN offer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_provider_offer(
  p_request_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  current_uid UUID := auth.uid();
  request_row RECORD;
  provider_loc GEOGRAPHY;
  provider_distance_km DOUBLE PRECISION;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.location
  INTO provider_loc
  FROM public.partners p
  WHERE p.id = current_uid;

  IF provider_loc IS NULL THEN
    RAISE EXCEPTION 'Provider location is required';
  END IF;

  SELECT *
  INTO request_row
  FROM public.requests r
  WHERE r.id = p_request_id
    AND r.provider_id IS NULL
    AND r.status IN ('finding', 'offered')
    AND (r.expires_at IS NULL OR r.expires_at > NOW());

  IF request_row IS NULL THEN
    RAISE EXCEPTION 'Request unavailable';
  END IF;

  IF request_row.lat IS NULL OR request_row.lng IS NULL THEN
    RAISE EXCEPTION 'Request location is missing';
  END IF;

  provider_distance_km :=
    ST_Distance(
      provider_loc::geography,
      ST_SetSRID(ST_MakePoint(request_row.lng, request_row.lat), 4326)::geography
    ) / 1000.0;

  IF provider_distance_km > 5 THEN
    RAISE EXCEPTION 'Request is outside provider dispatch radius';
  END IF;

  INSERT INTO public.provider_offers (
    request_id,
    provider_id,
    status,
    responded_at
  )
  VALUES (
    p_request_id,
    current_uid,
    'rejected',
    NOW()
  )
  ON CONFLICT (request_id, provider_id)
  DO UPDATE
  SET
    status = 'rejected',
    responded_at = NOW(),
    updated_at = NOW();

  IF EXISTS (
    SELECT 1
    FROM public.requests r
    WHERE r.id = p_request_id
      AND r.status = 'offered'
      AND r.provider_id IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.provider_offers po
    WHERE po.request_id = p_request_id
      AND po.status = 'offered'
  ) THEN
    UPDATE public.requests
    SET
      status = 'finding',
      updated_at = NOW()
    WHERE id = p_request_id
      AND provider_id IS NULL
      AND status = 'offered';
  END IF;
END;
$$;

-- -----------------------------------------------------------
-- 6) Client confirms one offer
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_provider_offer(
  p_request_id UUID,
  p_offer_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_uid UUID := auth.uid();
  request_row RECORD;
  selected_offer RECORD;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO request_row
  FROM public.requests r
  WHERE r.id = p_request_id
    AND r.user_id = current_uid
    AND r.status IN ('finding', 'offered', 'accepted')
  FOR UPDATE;

  IF request_row IS NULL THEN
    RAISE EXCEPTION 'Request not available for confirmation';
  END IF;

  SELECT *
  INTO selected_offer
  FROM public.provider_offers po
  WHERE po.id = p_offer_id
    AND po.request_id = p_request_id
    AND po.status = 'offered'
  FOR UPDATE;

  IF selected_offer IS NULL THEN
    RAISE EXCEPTION 'Offer not available';
  END IF;

  UPDATE public.requests
  SET
    provider_id = selected_offer.provider_id,
    status = 'accepted',
    displacement_fee = COALESCE(selected_offer.price, displacement_fee),
    updated_at = NOW()
  WHERE id = p_request_id;

  UPDATE public.provider_offers
  SET
    status = CASE WHEN id = p_offer_id THEN 'accepted' ELSE 'declined' END,
    updated_at = NOW()
  WHERE request_id = p_request_id
    AND status IN ('offered', 'accepted');

  INSERT INTO public.notifications (user_id, title, message, type, related_id, is_read)
  VALUES
    (
      selected_offer.provider_id,
      'Pedido confirmado',
      'O cliente confirmou sua oferta. Abra o app para iniciar o chat.',
      'request',
      p_request_id,
      false
    )
  ON CONFLICT DO NOTHING;
END;
$$;

-- -----------------------------------------------------------
-- 7) Grants
-- -----------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_provider_open_requests(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_provider_open_requests(INTEGER, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_provider_offer(UUID, NUMERIC, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_provider_offer(UUID, NUMERIC, INTEGER, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_provider_offer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_provider_offer(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.confirm_provider_offer(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_provider_offer(UUID, UUID) TO authenticated;
