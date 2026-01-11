-- Add saved_addresses column to clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS saved_addresses JSONB DEFAULT '[]'::jsonb;

-- Comment on column
COMMENT ON COLUMN public.clients.saved_addresses IS 'Array of saved user addresses with structure: { id, name, address, location: {latitude, longitude}, components: {...}, icon: string }';
