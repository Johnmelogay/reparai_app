-- ===========================================================
-- Checkout Confirmation RPC (Client -> Paid)
-- Created: 2026-03-18
-- Purpose:
-- 1) Confirm selected provider offer from checkout
-- 2) Persist payment method and paid status in requests
-- 3) Keep provider_offers statuses synchronized
-- ===========================================================

ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

CREATE OR REPLACE FUNCTION public.confirm_order(
  p_request_id UUID,
  p_offer_id UUID,
  p_payment_method TEXT DEFAULT NULL
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
  normalized_payment_method TEXT := lower(trim(COALESCE(p_payment_method, '')));
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF normalized_payment_method = '' THEN
    normalized_payment_method := 'pix';
  END IF;

  IF normalized_payment_method NOT IN ('credit_card', 'pix', 'cash') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  SELECT *
  INTO request_row
  FROM public.requests r
  WHERE r.id = p_request_id
    AND r.user_id = current_uid
    AND r.status IN ('finding', 'offered', 'accepted', 'paid')
  FOR UPDATE;

  IF request_row IS NULL THEN
    RAISE EXCEPTION 'Request not available for checkout';
  END IF;

  SELECT *
  INTO selected_offer
  FROM public.provider_offers po
  WHERE po.id = p_offer_id
    AND po.request_id = p_request_id
    AND po.status IN ('offered', 'accepted')
  FOR UPDATE;

  IF selected_offer IS NULL THEN
    RAISE EXCEPTION 'Offer not available for checkout';
  END IF;

  UPDATE public.requests
  SET
    provider_id = selected_offer.provider_id,
    status = 'paid',
    displacement_fee = COALESCE(selected_offer.price, displacement_fee),
    payment_method = normalized_payment_method,
    payment_status = 'paid',
    updated_at = NOW()
  WHERE id = p_request_id;

  UPDATE public.provider_offers
  SET
    status = CASE WHEN id = p_offer_id THEN 'accepted' ELSE 'declined' END,
    responded_at = CASE WHEN id = p_offer_id THEN NOW() ELSE responded_at END,
    updated_at = NOW()
  WHERE request_id = p_request_id
    AND status IN ('offered', 'accepted');

  INSERT INTO public.notifications (user_id, title, message, type, related_id, is_read)
  VALUES
    (
      selected_offer.provider_id,
      'Pedido pago e confirmado',
      'O cliente confirmou sua oferta no checkout. Abra o app para iniciar o chat.',
      'request',
      p_request_id,
      false
    )
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_order(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_order(UUID, UUID, TEXT) TO authenticated;
