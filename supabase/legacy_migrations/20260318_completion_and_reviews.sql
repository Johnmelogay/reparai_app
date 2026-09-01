-- ===========================================================
-- Completion flow & reviews system
-- Created: 2026-03-18
-- ===========================================================

-- 1. Add completion confirmation columns to requests
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS done_provider_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS done_client_at   TIMESTAMPTZ;

-- 2. Reviews table — one review per party per request
CREATE TABLE IF NOT EXISTS public.reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id),
  reviewee_id UUID NOT NULL REFERENCES auth.users(id),
  role        TEXT NOT NULL CHECK (role IN ('client', 'provider')),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, reviewer_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_request  ON public.reviews(request_id);

-- 3. RLS policies for reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone involved in the request can read reviews
CREATE POLICY reviews_select ON public.reviews
  FOR SELECT USING (
    reviewer_id = auth.uid() OR reviewee_id = auth.uid()
  );

-- Users can insert their own review
CREATE POLICY reviews_insert ON public.reviews
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid()
  );

-- 4. Function to recalculate partner average rating
CREATE OR REPLACE FUNCTION public.recalc_partner_rating()
RETURNS trigger AS $$
BEGIN
  UPDATE public.partners
  SET rating = sub.avg_rating
  FROM (
    SELECT reviewee_id, ROUND(AVG(rating)::numeric, 2) AS avg_rating
    FROM public.reviews
    WHERE reviewee_id = NEW.reviewee_id
    GROUP BY reviewee_id
  ) sub
  WHERE partners.id = sub.reviewee_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update rating on new review
DROP TRIGGER IF EXISTS trg_recalc_rating ON public.reviews;
CREATE TRIGGER trg_recalc_rating
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.recalc_partner_rating();

-- 5. RPC: provider marks "a caminho" (en_route)
CREATE OR REPLACE FUNCTION public.provider_set_en_route(p_request_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.requests
  SET status = 'en_route', updated_at = now()
  WHERE id = p_request_id
    AND provider_id = auth.uid()
    AND status = 'paid';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot set en_route: request not found or invalid status';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: provider confirms job done
CREATE OR REPLACE FUNCTION public.provider_confirm_done(p_request_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.requests
  SET done_provider_at = now(), updated_at = now()
  WHERE id = p_request_id
    AND provider_id = auth.uid()
    AND status = 'en_route'
    AND done_provider_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot confirm: request not found or already confirmed';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: client confirms job done
CREATE OR REPLACE FUNCTION public.client_confirm_done(p_request_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.requests
  SET done_client_at = now(), updated_at = now()
  WHERE id = p_request_id
    AND user_id = auth.uid()
    AND status = 'en_route'
    AND done_client_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot confirm: request not found or already confirmed';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: submit review with rating
CREATE OR REPLACE FUNCTION public.submit_review(
  p_request_id UUID,
  p_reviewee_id UUID,
  p_role TEXT,
  p_rating SMALLINT,
  p_comment TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Verify request is done
  IF NOT EXISTS (
    SELECT 1 FROM public.requests
    WHERE id = p_request_id AND status = 'done'
  ) THEN
    RAISE EXCEPTION 'Request must be completed before reviewing';
  END IF;

  INSERT INTO public.reviews (request_id, reviewer_id, reviewee_id, role, rating, comment)
  VALUES (p_request_id, auth.uid(), p_reviewee_id, p_role, p_rating, p_comment);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
