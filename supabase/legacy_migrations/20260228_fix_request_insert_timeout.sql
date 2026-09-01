-- Fix request creation timeout:
-- - make simulated offers non-blocking
-- - add indexes used in offer dispatch paths

CREATE INDEX IF NOT EXISTS idx_partners_online_dispatch
  ON public.partners (is_online)
  WHERE is_online = true;

CREATE INDEX IF NOT EXISTS idx_provider_offers_request_status
  ON public.provider_offers (request_id, status);

CREATE OR REPLACE FUNCTION public.simulate_provider_bids()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
  -- Never allow simulated-offer generation to block request creation.
  BEGIN
    INSERT INTO public.provider_offers (
      id, request_id, provider_id, status, price, estimated_time, message
    )
    SELECT
      gen_random_uuid(),
      NEW.id,
      p.id,
      'offered',
      ROUND((RANDOM() * 50 + 30)::numeric, 2),
      FLOOR(RANDOM() * 30 + 10)::integer,
      'Olá! Estou a caminho e disponível para resolver o problema agora mesmo.'
    FROM public.partners p
    WHERE p.is_online = true
    ORDER BY p.operational_score DESC NULLS LAST, p.rating DESC NULLS LAST
    LIMIT 3;
  EXCEPTION
    WHEN query_canceled THEN
      RAISE WARNING 'simulate_provider_bids timeout for request %', NEW.id;
    WHEN OTHERS THEN
      RAISE WARNING 'simulate_provider_bids failed for request %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
