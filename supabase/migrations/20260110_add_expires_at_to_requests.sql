-- Add expires_at column to requests table for urgent request expiration tracking
ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Add comment to document the column
COMMENT ON COLUMN public.requests.expires_at IS 'Timestamp when the request expires (for urgent requests)';

-- Create index for performance on filtering by expiration
CREATE INDEX IF NOT EXISTS idx_requests_expires_at ON public.requests(expires_at);

-- Force schema cache reload (Supabase specific)
NOTIFY pgrst, 'reload config';
