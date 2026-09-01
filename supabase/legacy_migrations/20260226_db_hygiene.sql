-- 1. Enable moddatetime extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- 2. Add updated_at trigger to requests table
DROP TRIGGER IF EXISTS handle_requests_updated_at ON public.requests;
CREATE TRIGGER handle_requests_updated_at
  BEFORE UPDATE ON public.requests
  FOR EACH ROW
  EXECUTE PROCEDURE moddatetime(updated_at);

-- 3. Create saved_addresses table with user_id foreign key
CREATE TABLE IF NOT EXISTS public.saved_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    streetNumber TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    icon TEXT DEFAULT 'MapPin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Add updated_at trigger to saved_addresses
DROP TRIGGER IF EXISTS handle_saved_addresses_updated_at ON public.saved_addresses;
CREATE TRIGGER handle_saved_addresses_updated_at
  BEFORE UPDATE ON public.saved_addresses
  FOR EACH ROW
  EXECUTE PROCEDURE moddatetime(updated_at);

-- 5. Enable RLS on saved_addresses
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for saved_addresses (Users can only access their own addresses)
CREATE POLICY "Users can view their own saved addresses"
ON public.saved_addresses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved addresses"
ON public.saved_addresses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved addresses"
ON public.saved_addresses FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved addresses"
ON public.saved_addresses FOR DELETE
USING (auth.uid() = user_id);
