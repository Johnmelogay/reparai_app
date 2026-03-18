-- ===========================================================
-- Fix: update provider_offers_status_check constraint
-- Created: 2026-03-18
-- ===========================================================

ALTER TABLE public.provider_offers
DROP CONSTRAINT IF EXISTS provider_offers_status_check;

ALTER TABLE public.provider_offers
ADD CONSTRAINT provider_offers_status_check 
CHECK (status = ANY (ARRAY['sent'::text, 'answered'::text, 'selected'::text, 'declined'::text, 'offered'::text, 'client_accepted'::text, 'rejected'::text, 'accepted'::text]));
