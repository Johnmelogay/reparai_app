-- ===========================================================
-- Add missing location columns to requests table
-- Created: 2026-03-18
-- ===========================================================

ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS neighborhood TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS street_number TEXT;
