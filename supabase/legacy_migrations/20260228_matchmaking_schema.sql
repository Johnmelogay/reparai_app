-- Migration: Uber-like Matchmaking Schema Update & Auto-Bidder
-- Created: 2026-02-28

-- 1. Add fields to provider_offers
ALTER TABLE public.provider_offers 
ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS estimated_time INTEGER,
ADD COLUMN IF NOT EXISTS message TEXT;

-- 2. Add payment fields to requests
ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- 3. Enable realtime for provider_offers if not already enabled
BEGIN;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'provider_offers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_offers;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END;

-- 4. Create the function to simulate provider bids
CREATE OR REPLACE FUNCTION public.simulate_provider_bids()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
    -- We'll insert 3 mock offers for the new request
    -- Using actual active partners from the DB
    INSERT INTO public.provider_offers (
        id, request_id, provider_id, status, price, estimated_time, message
    )
    SELECT 
        gen_random_uuid(),
        NEW.id,
        p.id,
        'offered',
        ROUND((RANDOM() * 50 + 30)::numeric, 2), -- 30 to 80 BRL
        FLOOR(RANDOM() * 30 + 10)::integer, -- 10 to 40 mins
        'Olá! Estou a caminho e disponível para resolver o problema agora mesmo.'
    FROM public.partners p
    WHERE p.is_online = true
    LIMIT 3;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create the trigger on requests
DROP TRIGGER IF EXISTS trg_simulate_provider_bids ON public.requests;
CREATE TRIGGER trg_simulate_provider_bids
AFTER INSERT ON public.requests
FOR EACH ROW
WHEN (NEW.status = 'finding')
EXECUTE FUNCTION public.simulate_provider_bids();

-- 6. Add policy for provider_offers update (if needed)
-- We might need clients to update an offer to 'client_accepted' later, but we'll do that via RPC.
