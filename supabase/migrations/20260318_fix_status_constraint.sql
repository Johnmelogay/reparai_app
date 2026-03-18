-- ===========================================================
-- Fix: update requests_status_check constraint
-- Created: 2026-03-18
-- ===========================================================

ALTER TABLE public.requests
DROP CONSTRAINT IF EXISTS requests_status_check;

ALTER TABLE public.requests
ADD CONSTRAINT requests_status_check 
CHECK (status = ANY (ARRAY['finding'::text, 'offered'::text, 'answered'::text, 'accepted'::text, 'paid'::text, 'en_route'::text, 'done'::text, 'declined'::text, 'canceled'::text, 'expired'::text]));
