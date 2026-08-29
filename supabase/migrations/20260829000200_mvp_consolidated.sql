-- ===========================================================
-- REPARAÍ — Consolidated MVP Migration (Fully Audited & Hardened)
-- Migration: 20260829000200_mvp_consolidated.sql
-- Purpose:
--   1. Reorder status migration: drop old CHECK -> normalize status -> add definitive CHECK
--   2. Strict enforce_request_rules trigger without completed/paid
--   3. Drop all UPDATE policies on requests dynamically (guarantee zero direct updates)
--   4. Ensure UNIQUE indexes on provider_offers and reviews exist
--   5. Add 'canceled' to provider_offers_status_check constraint
--   6. Drop all old overloads of RPCs before recreating (including submit_review integer/smallint)
--   7. Hardened RPCs with validation, bounds checks, address privacy & search_path
--   8. Enhanced client_cancel_request with offer cleanup, provider notification & reason
--   9. Zero hardcoded environment-specific UUIDs
-- ===========================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- SECTION 1: Schema additions & column creation
-- ═══════════════════════════════════════════════════════════

-- 1a. New columns on requests
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS service_quote numeric,
  ADD COLUMN IF NOT EXISTS service_payment_status text,
  ADD COLUMN IF NOT EXISTS displacement_payment_method text,
  ADD COLUMN IF NOT EXISTS service_payment_method text,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- 1b. New columns on partners
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS push_token text,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

-- 1c. Ensure unique constraints / indexes exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_offers_request_provider_unique
  ON public.provider_offers (request_id, provider_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_request_reviewer_unique
  ON public.reviews (request_id, reviewer_id);

-- 1d. Allow 'canceled' in provider_offers status check
ALTER TABLE public.provider_offers
  DROP CONSTRAINT IF EXISTS provider_offers_status_check;

ALTER TABLE public.provider_offers
  ADD CONSTRAINT provider_offers_status_check
  CHECK (status = ANY (ARRAY[
    'offered'::text,
    'accepted'::text,
    'declined'::text,
    'rejected'::text,
    'canceled'::text,
    'sent'::text,
    'answered'::text,
    'selected'::text,
    'client_accepted'::text
  ]));

-- ═══════════════════════════════════════════════════════════
-- SECTION 2: Safe status normalization & CHECK constraint
-- ═══════════════════════════════════════════════════════════

-- 2a. Drop old CHECK constraint first
ALTER TABLE public.requests
  DROP CONSTRAINT IF EXISTS requests_status_check;

-- 2b. Temporarily disable trigger while migrating status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.requests'::regclass
      AND tgname = 'trg_enforce_request_rules'
  ) THEN
    ALTER TABLE public.requests DISABLE TRIGGER trg_enforce_request_rules;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.requests'::regclass
      AND tgname = 'enforce_request_rules'
  ) THEN
    ALTER TABLE public.requests DISABLE TRIGGER enforce_request_rules;
  END IF;
END;
$$;

-- 2c. Normalize legacy status data
UPDATE public.requests
SET status = 'confirmed', updated_at = NOW()
WHERE status = 'paid';

UPDATE public.requests
SET status = 'done', updated_at = NOW()
WHERE status = 'completed';

-- 2d. Apply definitive status CHECK constraint (paid and completed are removed)
ALTER TABLE public.requests
  ADD CONSTRAINT requests_status_check
  CHECK (status = ANY (ARRAY[
    'draft'::text,
    'finding'::text,
    'offered'::text,
    'answered'::text,
    'accepted'::text,
    'confirmed'::text,
    'en_route'::text,
    'arrived'::text,
    'quote_provided'::text,
    'quote_accepted'::text,
    'done'::text,
    'declined'::text,
    'canceled'::text,
    'expired'::text,
    'disputed'::text
  ]));

-- ═══════════════════════════════════════════════════════════
-- SECTION 3: Trigger enforce_request_rules (definitive)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_request_rules()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN

    -- Terminal statuses cannot transition (except done -> disputed)
    IF OLD.status IN ('declined', 'canceled', 'expired') THEN
      RAISE EXCEPTION 'cannot_change_terminal_status: %', OLD.status;
    END IF;

    IF OLD.status = 'done' AND NEW.status <> 'disputed' THEN
      RAISE EXCEPTION 'done_only_transitions_to_disputed';
    END IF;

    -- draft -> finding, canceled
    IF OLD.status = 'draft' AND NEW.status NOT IN ('finding', 'canceled') THEN
      RAISE EXCEPTION 'invalid_transition_from_draft_to_%', NEW.status;
    END IF;

    -- finding -> offered, answered, declined, canceled, expired
    IF OLD.status = 'finding' AND NEW.status NOT IN ('offered', 'answered', 'declined', 'canceled', 'expired') THEN
      RAISE EXCEPTION 'invalid_transition_from_finding_to_%', NEW.status;
    END IF;

    -- offered / answered -> offered, answered, accepted, confirmed, declined, canceled, expired
    IF OLD.status IN ('offered', 'answered') AND NEW.status NOT IN (
      'offered', 'answered', 'accepted', 'confirmed', 'declined', 'canceled', 'expired'
    ) THEN
      RAISE EXCEPTION 'invalid_transition_from_%_to_%', OLD.status, NEW.status;
    END IF;

    -- accepted -> confirmed, declined, canceled
    IF OLD.status = 'accepted' AND NEW.status NOT IN ('confirmed', 'declined', 'canceled') THEN
      RAISE EXCEPTION 'invalid_transition_from_accepted_to_%', NEW.status;
    END IF;

    -- confirmed -> en_route, canceled
    IF OLD.status = 'confirmed' AND NEW.status NOT IN ('en_route', 'canceled') THEN
      RAISE EXCEPTION 'invalid_transition_from_confirmed_to_%', NEW.status;
    END IF;

    -- en_route -> arrived, canceled
    IF OLD.status = 'en_route' AND NEW.status NOT IN ('arrived', 'canceled') THEN
      RAISE EXCEPTION 'invalid_transition_from_en_route_to_%', NEW.status;
    END IF;

    -- arrived -> quote_provided, canceled, disputed
    IF OLD.status = 'arrived' AND NEW.status NOT IN ('quote_provided', 'canceled', 'disputed') THEN
      RAISE EXCEPTION 'invalid_transition_from_arrived_to_%', NEW.status;
    END IF;

    -- quote_provided -> quote_accepted, canceled, disputed
    IF OLD.status = 'quote_provided' AND NEW.status NOT IN ('quote_accepted', 'canceled', 'disputed') THEN
      RAISE EXCEPTION 'invalid_transition_from_quote_provided_to_%', NEW.status;
    END IF;

    -- quote_accepted -> done, canceled, disputed
    IF OLD.status = 'quote_accepted' AND NEW.status NOT IN ('done', 'canceled', 'disputed') THEN
      RAISE EXCEPTION 'invalid_transition_from_quote_accepted_to_%', NEW.status;
    END IF;

    -- disputed -> done, canceled
    IF OLD.status = 'disputed' AND NEW.status NOT IN ('done', 'canceled') THEN
      RAISE EXCEPTION 'invalid_transition_from_disputed_to_%', NEW.status;
    END IF;

    -- Validation for explicit done transition
    IF NEW.status = 'done' AND (NEW.done_client_at IS NULL OR NEW.done_provider_at IS NULL) THEN
      RAISE EXCEPTION 'done_requires_both_confirmations';
    END IF;

  END IF;

  -- Auto-finish when both confirmations exist on quote_accepted
  IF NEW.status = 'quote_accepted'
     AND NEW.done_client_at IS NOT NULL
     AND NEW.done_provider_at IS NOT NULL
  THEN
    NEW.status := 'done';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop any duplicate/legacy trigger definitions
DROP TRIGGER IF EXISTS trg_enforce_request_rules ON public.requests;
DROP TRIGGER IF EXISTS enforce_request_rules ON public.requests;

CREATE TRIGGER trg_enforce_request_rules
BEFORE UPDATE ON public.requests
FOR EACH ROW
EXECUTE FUNCTION public.enforce_request_rules();

-- ═══════════════════════════════════════════════════════════
-- SECTION 4: Dynamic RLS hardening on requests
-- ═══════════════════════════════════════════════════════════

-- Dynamically drop ALL UPDATE policies on public.requests.
-- Guaranteed zero direct UPDATE permissions remain for clients or providers.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'requests'
      AND cmd = 'UPDATE'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.requests', r.policyname);
  END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- SECTION 5: Drop all old RPC signatures
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.confirm_order(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.provider_set_en_route(UUID);
DROP FUNCTION IF EXISTS public.provider_set_arrived(UUID);
DROP FUNCTION IF EXISTS public.provider_submit_quote(UUID, NUMERIC);
DROP FUNCTION IF EXISTS public.client_accept_quote(UUID, TEXT);
DROP FUNCTION IF EXISTS public.client_cancel_request(UUID, TEXT);
DROP FUNCTION IF EXISTS public.client_cancel_request(UUID);
DROP FUNCTION IF EXISTS public.provider_confirm_done(UUID);
DROP FUNCTION IF EXISTS public.client_confirm_done(UUID);
DROP FUNCTION IF EXISTS public.get_provider_open_requests(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.submit_provider_offer(UUID, NUMERIC, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.submit_review(UUID, UUID, TEXT, SMALLINT, TEXT);
DROP FUNCTION IF EXISTS public.submit_review(UUID, UUID, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.submit_review(UUID, SMALLINT, TEXT);
DROP FUNCTION IF EXISTS public.submit_review(UUID, INTEGER, TEXT);

-- ═══════════════════════════════════════════════════════════
-- SECTION 6: RPC confirm_order (Checkout -> confirmed)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.confirm_order(
  p_request_id UUID,
  p_offer_id UUID,
  p_payment_method TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  current_uid UUID := auth.uid();
  request_row RECORD;
  selected_offer RECORD;
  partner_row RECORD;
  normalized_payment_method TEXT := lower(trim(COALESCE(p_payment_method, '')));
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF normalized_payment_method = '' THEN
    normalized_payment_method := 'cash';
  END IF;

  IF normalized_payment_method NOT IN ('credit_card', 'pix', 'cash') THEN
    RAISE EXCEPTION 'invalid_payment_method';
  END IF;

  SELECT *
  INTO request_row
  FROM public.requests r
  WHERE r.id = p_request_id
    AND r.user_id = current_uid
    AND r.status IN ('finding', 'offered', 'accepted')
  FOR UPDATE;

  IF request_row IS NULL THEN
    RAISE EXCEPTION 'request_not_available';
  END IF;

  SELECT *
  INTO selected_offer
  FROM public.provider_offers po
  WHERE po.id = p_offer_id
    AND po.request_id = p_request_id
    AND po.status IN ('offered', 'accepted')
  FOR UPDATE;

  IF selected_offer IS NULL THEN
    RAISE EXCEPTION 'offer_not_available';
  END IF;

  -- Re-verify provider eligibility
  SELECT id, is_verified, is_online
  INTO partner_row
  FROM public.partners
  WHERE id = selected_offer.provider_id;

  IF partner_row IS NULL OR COALESCE(partner_row.is_verified, false) = false THEN
    RAISE EXCEPTION 'provider_not_eligible';
  END IF;

  UPDATE public.requests
  SET
    provider_id = selected_offer.provider_id,
    status = 'confirmed',
    displacement_fee = COALESCE(selected_offer.price, displacement_fee),
    displacement_payment_method = normalized_payment_method,
    payment_method = normalized_payment_method,
    payment_status = 'pending',
    updated_at = NOW()
  WHERE id = p_request_id;

  UPDATE public.provider_offers
  SET
    status = CASE WHEN id = p_offer_id THEN 'accepted' ELSE 'declined' END,
    responded_at = CASE WHEN id = p_offer_id THEN NOW() ELSE responded_at END,
    updated_at = NOW()
  WHERE request_id = p_request_id
    AND status IN ('offered', 'accepted');

  -- Deduplicated notification
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = selected_offer.provider_id
      AND related_id = p_request_id
      AND type = 'request'
  ) THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_id, is_read)
    VALUES (
      selected_offer.provider_id,
      'Pedido confirmado',
      'O cliente confirmou sua oferta. Abra o app para iniciar.',
      'request',
      p_request_id,
      false
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_order(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order(UUID, UUID, TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- SECTION 7: RPC provider_set_en_route
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.provider_set_en_route(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  current_uid UUID := auth.uid();
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.partners
    WHERE id = current_uid AND is_verified = true
  ) THEN
    RAISE EXCEPTION 'provider_not_verified';
  END IF;

  UPDATE public.requests
  SET status = 'en_route', updated_at = NOW()
  WHERE id = p_request_id
    AND provider_id = current_uid
    AND status = 'confirmed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_request_or_status';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.provider_set_en_route(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provider_set_en_route(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- SECTION 8: RPC provider_set_arrived
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.provider_set_arrived(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  current_uid UUID := auth.uid();
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.requests
  SET status = 'arrived', updated_at = NOW()
  WHERE id = p_request_id
    AND provider_id = current_uid
    AND status = 'en_route';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_request_or_status';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.provider_set_arrived(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provider_set_arrived(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- SECTION 9: RPC provider_submit_quote
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.provider_submit_quote(
  p_request_id UUID,
  p_quote_price NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  current_uid UUID := auth.uid();
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_quote_price IS NULL OR p_quote_price <= 0 OR p_quote_price > 100000.00 THEN
    RAISE EXCEPTION 'invalid_quote_price_range';
  END IF;

  IF round(p_quote_price, 2) <> p_quote_price THEN
    RAISE EXCEPTION 'invalid_quote_price_scale';
  END IF;

  UPDATE public.requests
  SET
    status = 'quote_provided',
    service_quote = p_quote_price,
    updated_at = NOW()
  WHERE id = p_request_id
    AND provider_id = current_uid
    AND status = 'arrived';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_request_or_status';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.provider_submit_quote(UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provider_submit_quote(UUID, NUMERIC) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- SECTION 10: RPC client_accept_quote
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.client_accept_quote(
  p_request_id UUID,
  p_payment_method TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  current_uid UUID := auth.uid();
  normalized_method TEXT := lower(trim(COALESCE(p_payment_method, 'cash')));
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF normalized_method NOT IN ('credit_card', 'pix', 'cash') THEN
    RAISE EXCEPTION 'invalid_payment_method';
  END IF;

  UPDATE public.requests
  SET
    status = 'quote_accepted',
    service_payment_status = 'pending',
    service_payment_method = normalized_method,
    updated_at = NOW()
  WHERE id = p_request_id
    AND user_id = current_uid
    AND status = 'quote_provided';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_request_or_status';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.client_accept_quote(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_accept_quote(UUID, TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- SECTION 11: RPC client_cancel_request (with offer cleanup)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.client_cancel_request(
  p_request_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  current_uid UUID := auth.uid();
  req_row RECORD;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT id, user_id, provider_id, status
  INTO req_row
  FROM public.requests
  WHERE id = p_request_id
    AND user_id = current_uid
  FOR UPDATE;

  IF req_row IS NULL THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  IF req_row.status NOT IN ('draft', 'finding', 'offered', 'accepted', 'confirmed') THEN
    RAISE EXCEPTION 'request_not_cancellable';
  END IF;

  UPDATE public.requests
  SET
    status = 'canceled',
    cancellation_reason = NULLIF(TRIM(COALESCE(p_reason, '')), ''),
    updated_at = NOW()
  WHERE id = p_request_id;

  -- Clean up associated offers
  UPDATE public.provider_offers
  SET
    status = CASE WHEN status = 'accepted' THEN 'canceled' ELSE 'declined' END,
    updated_at = NOW()
  WHERE request_id = p_request_id
    AND status IN ('offered', 'accepted');

  -- Notify assigned provider if cancellation occurred after match
  IF req_row.provider_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_id, is_read)
    VALUES (
      req_row.provider_id,
      'Pedido cancelado',
      'O cliente cancelou a solicitação.',
      'request',
      p_request_id,
      false
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.client_cancel_request(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_cancel_request(UUID, TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- SECTION 12: Completion RPCs (quote_accepted only)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.provider_confirm_done(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  current_uid UUID := auth.uid();
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.requests
  SET done_provider_at = NOW(), updated_at = NOW()
  WHERE id = p_request_id
    AND provider_id = current_uid
    AND status = 'quote_accepted'
    AND done_provider_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cannot_confirm_done';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.provider_confirm_done(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provider_confirm_done(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.client_confirm_done(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  current_uid UUID := auth.uid();
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.requests
  SET done_client_at = NOW(), updated_at = NOW()
  WHERE id = p_request_id
    AND user_id = current_uid
    AND status = 'quote_accepted'
    AND done_client_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cannot_confirm_done';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.client_confirm_done(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_confirm_done(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- SECTION 13: Feed & Bidding with verification & privacy
-- ═══════════════════════════════════════════════════════════

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
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  current_uid UUID := auth.uid();
  provider_row RECORD;
  bounded_radius_km INTEGER;
  bounded_limit INTEGER;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT p.location, p.is_online, p.is_verified
  INTO provider_row
  FROM public.partners p
  WHERE p.id = current_uid;

  IF provider_row IS NULL OR provider_row.location IS NULL THEN
    RETURN;
  END IF;

  IF COALESCE(provider_row.is_online, false) = false THEN
    RETURN;
  END IF;

  IF COALESCE(provider_row.is_verified, false) = false THEN
    RAISE EXCEPTION 'provider_not_verified';
  END IF;

  bounded_radius_km := LEAST(GREATEST(COALESCE(input_radius_km, 5), 1), 20);
  bounded_limit := LEAST(GREATEST(COALESCE(input_limit, 50), 1), 100);

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
    -- Address privacy: full street address hidden from unassigned open feed
    NULL::TEXT AS address,
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
      bounded_radius_km * 1000
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.provider_offers po
      WHERE po.request_id = r.id
        AND po.provider_id = current_uid
        AND po.status IN ('offered', 'accepted', 'rejected', 'declined')
    )
  ORDER BY dist_km ASC, r.created_at DESC
  LIMIT bounded_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_provider_open_requests(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_provider_open_requests(INTEGER, INTEGER) TO authenticated;

-- submit_provider_offer
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

  RETURN offer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_provider_offer(UUID, NUMERIC, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_provider_offer(UUID, NUMERIC, INTEGER, TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- SECTION 14: Hardened submit_review (single clean RPC + safe overload)
-- ═══════════════════════════════════════════════════════════

-- Clean 3-arg signature (derives reviewee and role server-side)
CREATE OR REPLACE FUNCTION public.submit_review(
  p_request_id UUID,
  p_rating SMALLINT,
  p_comment TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  current_uid UUID := auth.uid();
  req_row RECORD;
  derived_reviewee_id UUID;
  derived_role TEXT;
  cleaned_comment TEXT;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'invalid_rating_range';
  END IF;

  cleaned_comment := NULLIF(TRIM(COALESCE(p_comment, '')), '');
  IF cleaned_comment IS NOT NULL AND length(cleaned_comment) > 1000 THEN
    RAISE EXCEPTION 'comment_too_long';
  END IF;

  SELECT id, user_id, provider_id, status
  INTO req_row
  FROM public.requests
  WHERE id = p_request_id;

  IF req_row IS NULL THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  IF req_row.status <> 'done' THEN
    RAISE EXCEPTION 'request_must_be_done';
  END IF;

  IF current_uid = req_row.user_id THEN
    derived_reviewee_id := req_row.provider_id;
    derived_role := 'provider';
  ELSIF current_uid = req_row.provider_id THEN
    derived_reviewee_id := req_row.user_id;
    derived_role := 'client';
  ELSE
    RAISE EXCEPTION 'unauthorized_participant';
  END IF;

  IF derived_reviewee_id IS NULL THEN
    RAISE EXCEPTION 'missing_reviewee';
  END IF;

  INSERT INTO public.reviews (
    request_id, reviewer_id, reviewee_id, role, rating, comment
  )
  VALUES (
    p_request_id, current_uid, derived_reviewee_id, derived_role, p_rating, cleaned_comment
  )
  ON CONFLICT (request_id, reviewer_id)
  DO UPDATE SET
    rating = EXCLUDED.rating,
    comment = EXCLUDED.comment;
END;
$$;

-- Backward-compatible 5-arg overload (ignores client-passed reviewee/role, routes safely)
CREATE OR REPLACE FUNCTION public.submit_review(
  p_request_id UUID,
  p_reviewee_id UUID,
  p_role TEXT,
  p_rating SMALLINT,
  p_comment TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  PERFORM public.submit_review(p_request_id, p_rating, p_comment);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_review(UUID, SMALLINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_review(UUID, SMALLINT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_review(UUID, UUID, TEXT, SMALLINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_review(UUID, UUID, TEXT, SMALLINT, TEXT) TO authenticated;

-- ============================================================
-- SECTION 15: Public Map Providers RPC (get_map_partners_v2)
-- ============================================================

DROP FUNCTION IF EXISTS public.get_map_partners_v2(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.get_map_partners_v2(
  input_lat DOUBLE PRECISION,
  input_long DOUBLE PRECISION,
  radius_km INTEGER DEFAULT 5,
  max_limit INTEGER DEFAULT 50
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
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_current_uid UUID;
  v_effective_radius INTEGER;
  v_effective_limit INTEGER;
BEGIN
  v_current_uid := auth.uid();
  IF v_current_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated: authentication required to query map partners'
      USING ERRCODE = '42501';
  END IF;

  -- Clamp radius to min 1km, max 20km (default 5km)
  v_effective_radius := LEAST(GREATEST(COALESCE(radius_km, 5), 1), 20);
  -- Clamp limit to min 1, max 100 (default 50)
  v_effective_limit := LEAST(GREATEST(COALESCE(max_limit, 50), 1), 100);

  RETURN QUERY
  SELECT
    pa.id,
    COALESCE(pa.full_name, 'Prestador') AS full_name,
    COALESCE(pa.avatar_url, '') AS avatar_url,
    COALESCE(pa.service_category, 'Geral') AS service_category,
    COALESCE(pa.rating, 5.0) AS rating,
    -- Fuzz coordinates to ~2 decimal places (~1km precision) for exploratory privacy
    ROUND(ST_Y(pa.location::geometry)::numeric, 2)::DOUBLE PRECISION AS lat,
    ROUND(ST_X(pa.location::geometry)::numeric, 2)::DOUBLE PRECISION AS long,
    pa.is_online,
    ROUND(
      (
        ST_Distance(
          pa.location::geography,
          ST_SetSRID(ST_MakePoint(input_long, input_lat), 4326)::geography
        ) / 1000.0
      )::numeric,
      1
    )::DOUBLE PRECISION AS dist_km,
    pa.base_fee AS hourly_rate,
    COALESCE(pa.type, 'MOBILE')::TEXT AS type
  FROM public.partners pa
  WHERE pa.location IS NOT NULL
    AND COALESCE(pa.is_online, false) = true
    AND COALESCE(pa.is_verified, false) = true
    AND ST_DWithin(
      pa.location::geography,
      ST_SetSRID(ST_MakePoint(input_long, input_lat), 4326)::geography,
      v_effective_radius * 1000
    )
  ORDER BY dist_km ASC
  LIMIT v_effective_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_map_partners_v2(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_map_partners_v2(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO authenticated;

-- ============================================================
-- SECTION 16: Saved Addresses Table & RLS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.saved_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    streetnumber TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own saved addresses" ON public.saved_addresses;

CREATE POLICY "Users can manage their own saved addresses"
ON public.saved_addresses
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.saved_addresses TO authenticated;
REVOKE ALL ON public.saved_addresses FROM anon, PUBLIC;

COMMIT;
