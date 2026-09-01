-- Migration: 20260901020000_lifecycle_matching_p0.sql
-- Description: Patch P0 - Order Lifecycle & Realtime Matching
--   1. Update submit_provider_offer to notify client on new offer (without duplicates on retry)
--   2. Add client_keep_request_open_v1 to allow client to keep search open in background (extends expires_at by 48h)

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- SECTION 1: Updated submit_provider_offer with offer notification
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.submit_provider_offer(
  p_request_id UUID,
  p_price NUMERIC DEFAULT NULL,
  p_estimated_time INTEGER DEFAULT NULL,
  p_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  current_uid UUID := auth.uid();
  offer_id UUID;
  request_row RECORD;
  provider_row RECORD;
  provider_distance_km DOUBLE PRECISION;
  bounded_price NUMERIC;
  bounded_time INTEGER;
  cleaned_message TEXT;
  existing_offer_id UUID;
  is_new_offer BOOLEAN := false;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT *
  INTO provider_row
  FROM public.partners p
  WHERE p.id = current_uid;

  IF provider_row IS NULL THEN
    RAISE EXCEPTION 'provider_profile_not_found';
  END IF;

  IF COALESCE(provider_row.is_verified, false) = false THEN
    RAISE EXCEPTION 'provider_not_verified';
  END IF;

  IF COALESCE(provider_row.is_online, false) = false THEN
    RAISE EXCEPTION 'provider_must_be_online';
  END IF;

  IF provider_row.location IS NULL THEN
    RAISE EXCEPTION 'provider_location_required';
  END IF;

  bounded_price := COALESCE(p_price, provider_row.base_fee, 0);
  IF bounded_price < 0 OR bounded_price > 50000.00 THEN
    RAISE EXCEPTION 'invalid_offer_price';
  END IF;

  bounded_time := COALESCE(NULLIF(p_estimated_time, 0), 30);
  IF bounded_time < 1 OR bounded_time > 1440 THEN
    RAISE EXCEPTION 'invalid_estimated_time';
  END IF;

  cleaned_message := NULLIF(TRIM(COALESCE(p_message, '')), '');
  IF cleaned_message IS NOT NULL AND length(cleaned_message) > 500 THEN
    RAISE EXCEPTION 'message_too_long';
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
    RAISE EXCEPTION 'request_unavailable';
  END IF;

  IF request_row.lat IS NULL OR request_row.lng IS NULL THEN
    RAISE EXCEPTION 'request_location_missing';
  END IF;

  provider_distance_km :=
    ST_Distance(
      provider_row.location::geography,
      ST_SetSRID(ST_MakePoint(request_row.lng, request_row.lat), 4326)::geography
    ) / 1000.0;

  IF provider_distance_km > 20 THEN
    RAISE EXCEPTION 'outside_dispatch_radius';
  END IF;

  -- Check if this provider already submitted an offer for this request
  SELECT id INTO existing_offer_id
  FROM public.provider_offers
  WHERE request_id = p_request_id
    AND provider_id = current_uid;

  IF existing_offer_id IS NULL THEN
    is_new_offer := true;
  END IF;

  INSERT INTO public.provider_offers (
    request_id, provider_id, status, price,
    estimated_time, message, responded_at
  )
  VALUES (
    p_request_id, current_uid, 'offered',
    bounded_price,
    bounded_time,
    cleaned_message,
    NOW()
  )
  ON CONFLICT (request_id, provider_id)
  DO UPDATE SET
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

  -- Notify client only if this is a newly created offer (no duplicate on retry/edit)
  IF is_new_offer AND request_row.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id, title, message, type, related_id, is_read
    )
    VALUES (
      request_row.user_id,
      'Nova oferta recebida',
      'Você recebeu uma nova proposta para o seu pedido.',
      'offer',
      p_request_id,
      false
    );
  END IF;

  RETURN offer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_provider_offer(UUID, NUMERIC, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_provider_offer(UUID, NUMERIC, INTEGER, TEXT) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- SECTION 2: RPC client_keep_request_open_v1 (Background Search)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.client_keep_request_open_v1(
  p_request_id UUID
)
RETURNS public.requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  current_uid UUID := auth.uid();
  updated_row public.requests;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT *
  INTO updated_row
  FROM public.requests
  WHERE id = p_request_id
    AND user_id = current_uid
  FOR UPDATE;

  IF updated_row.id IS NULL THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  IF updated_row.status NOT IN ('finding', 'offered') THEN
    RAISE EXCEPTION 'request_not_in_search';
  END IF;

  IF updated_row.provider_id IS NOT NULL THEN
    RAISE EXCEPTION 'provider_already_assigned';
  END IF;

  -- Extend search window to 48 hours from now, keeping current status
  UPDATE public.requests
  SET
    expires_at = NOW() + INTERVAL '48 hours',
    updated_at = NOW()
  WHERE id = p_request_id
  RETURNING * INTO updated_row;

  RETURN updated_row;
END;
$$;

REVOKE ALL ON FUNCTION public.client_keep_request_open_v1(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_keep_request_open_v1(UUID) TO authenticated;

COMMIT;
