-- Migration: 20260901030000_feed_realtime_and_dismissal_p0_1.sql
-- Description: Patch P0.1 - Realtime Feed Signal and Provider Request Dismissals
--   1. Create public.open_requests_signal singleton table with RLS for partners
--   2. Create trigger signal_open_requests_change_v1 on public.requests to update signal
--   3. Add open_requests_signal to supabase_realtime publication
--   4. Create public.provider_request_dismissals table
--   5. Create RPC dismiss_provider_request_v1(UUID)
--   6. Update get_provider_open_requests to filter out dismissed requests

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- SECTION 1: Realtime Feed Signal Table (open_requests_signal)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.open_requests_signal (
  id INTEGER PRIMARY KEY,
  revision BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_open_requests_signal_singleton CHECK (id = 1)
);

-- Insert singleton row idempotently
INSERT INTO public.open_requests_signal (id, revision, updated_at)
VALUES (1, 0, NOW())
ON CONFLICT (id) DO NOTHING;

-- RLS Configuration
ALTER TABLE public.open_requests_signal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_requests_signal FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.open_requests_signal FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.open_requests_signal TO authenticated;

DROP POLICY IF EXISTS "open_requests_signal_select_partners" ON public.open_requests_signal;
CREATE POLICY "open_requests_signal_select_partners"
  ON public.open_requests_signal
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.partners p
      WHERE p.id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════
-- SECTION 2: Trigger on public.requests to bump feed signal
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.signal_open_requests_change_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('finding', 'offered') AND NEW.provider_id IS NULL THEN
      UPDATE public.open_requests_signal
      SET
        revision = revision + 1,
        updated_at = NOW()
      WHERE id = 1;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('finding', 'offered') AND OLD.provider_id IS NULL THEN
      UPDATE public.open_requests_signal
      SET
        revision = revision + 1,
        updated_at = NOW()
      WHERE id = 1;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.status IN ('finding', 'offered') AND OLD.provider_id IS NULL)
       OR (NEW.status IN ('finding', 'offered') AND NEW.provider_id IS NULL)
    THEN
      IF (OLD.status IS DISTINCT FROM NEW.status)
         OR (OLD.provider_id IS DISTINCT FROM NEW.provider_id)
         OR (OLD.expires_at IS DISTINCT FROM NEW.expires_at)
         OR (OLD.category IS DISTINCT FROM NEW.category)
         OR (OLD.lat IS DISTINCT FROM NEW.lat)
         OR (OLD.lng IS DISTINCT FROM NEW.lng)
      THEN
        UPDATE public.open_requests_signal
        SET
          revision = revision + 1,
          updated_at = NOW()
        WHERE id = 1;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.signal_open_requests_change_v1() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_signal_open_requests_change ON public.requests;
CREATE TRIGGER trg_signal_open_requests_change
AFTER INSERT OR UPDATE OR DELETE ON public.requests
FOR EACH ROW
EXECUTE FUNCTION public.signal_open_requests_change_v1();


-- ═══════════════════════════════════════════════════════════
-- SECTION 3: Realtime Publication
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'open_requests_signal'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.open_requests_signal;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════
-- SECTION 4: Provider Request Dismissals Table
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.provider_request_dismissals (
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (request_id, provider_id)
);

ALTER TABLE public.provider_request_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_request_dismissals FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.provider_request_dismissals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.provider_request_dismissals TO authenticated;

DROP POLICY IF EXISTS "provider_request_dismissals_select_own" ON public.provider_request_dismissals;
CREATE POLICY "provider_request_dismissals_select_own"
  ON public.provider_request_dismissals
  FOR SELECT TO authenticated
  USING (provider_id = auth.uid());


-- ═══════════════════════════════════════════════════════════
-- SECTION 5: RPC dismiss_provider_request_v1
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.dismiss_provider_request_v1(
  p_request_id UUID
)
RETURNS VOID
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

  IF NOT EXISTS (SELECT 1 FROM public.partners WHERE id = current_uid) THEN
    RAISE EXCEPTION 'provider_profile_not_found';
  END IF;

  -- Idempotency: if already dismissed by this provider, return immediately
  IF EXISTS (
    SELECT 1 FROM public.provider_request_dismissals
    WHERE request_id = p_request_id
      AND provider_id = current_uid
  ) THEN
    RETURN;
  END IF;

  -- Verify request is currently available to this provider via get_provider_open_requests
  IF NOT EXISTS (
    SELECT 1
    FROM public.get_provider_open_requests(20, 100) g
    WHERE g.id = p_request_id
  ) THEN
    RAISE EXCEPTION 'request_unavailable';
  END IF;

  INSERT INTO public.provider_request_dismissals (request_id, provider_id)
  VALUES (p_request_id, current_uid)
  ON CONFLICT (request_id, provider_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.dismiss_provider_request_v1(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_provider_request_v1(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- SECTION 6: Update get_provider_open_requests with dismissal filter
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
    AND NOT EXISTS (
      SELECT 1
      FROM public.provider_request_dismissals prd
      WHERE prd.request_id = r.id
        AND prd.provider_id = current_uid
    )
  ORDER BY dist_km ASC, r.created_at DESC
  LIMIT bounded_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_provider_open_requests(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_provider_open_requests(INTEGER, INTEGER) TO authenticated;

COMMIT;
