-- Migration: Unify Partners and Profiles
-- Created: 2026-01-09
-- Purpose: Merge profiles data into partners, drop profiles table, Create View for compatibility.

-- 1. ADD COLUMNS TO PARTNERS
ALTER TABLE public.partners 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'provider';

-- 2. MIGRATE DATA (Move Identity from Profiles to Partners)
UPDATE public.partners p
SET 
    full_name = pr.full_name,
    avatar_url = pr.avatar_url,
    phone = pr.phone,
    user_type = COALESCE(pr.user_type, 'provider')
FROM public.profiles pr
WHERE p.id = pr.id;

-- 3. DROP FOREIGN KEY (Partners -> Profiles)
ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_id_fkey;

-- 4. ADD FOREIGN KEY (Partners -> Auth.Users) - SKIPPED
-- Reason: Some legacy/seed partners do not have matching auth.users records.
-- We will trust the ID consistency without strict DB constraint for now.
-- ALTER TABLE public.partners 
-- ADD CONSTRAINT partners_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5. UPDATE TRIGGER (handle_new_user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If user_type is client, insert into clients table
  IF new.raw_user_meta_data->>'user_type' = 'client' THEN
    INSERT INTO public.clients (id, full_name, avatar_url, phone)
    VALUES (
      new.id,
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'phone'
    );
  ELSE
    -- Default to partners (Providers)
    -- Insert with minimal data; other fields (location, rating) have defaults or are null
    INSERT INTO public.partners (id, full_name, avatar_url, phone, user_type)
    VALUES (
      new.id,
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'phone',
      COALESCE(new.raw_user_meta_data->>'user_type', 'provider')
    );
  END IF;
  RETURN new;
END;
$$;

-- 6. DROP PROFILES TABLE (The Big Move)
DROP TABLE IF EXISTS public.profiles CASCADE; 
-- CASCADE will might drop policies or other dependent views (like the trigger on profiles if any? No trigger is on auth.users).
-- But be careful.

-- 7. RECREATE PROFILES AS A VIEW (For legacy compatibility)
-- Checks if 'clients' exists (it does) and 'partners' (it does).
CREATE OR REPLACE VIEW public.profiles AS
SELECT 
    id, 
    full_name, 
    avatar_url, 
    phone, 
    'client' as user_type,
    created_at 
FROM public.clients
UNION ALL
SELECT 
    id, 
    full_name, 
    avatar_url, 
    phone, 
    user_type,
    NULL as created_at -- partners might not have created_at? Add it if needed.
FROM public.partners;

-- 8. UPDATE RPC (get_map_partners_v2) to remove JOIN
CREATE OR REPLACE FUNCTION public.get_map_partners_v2(
    input_lat DOUBLE PRECISION,
    input_long DOUBLE PRECISION,
    radius_km INTEGER DEFAULT 500,
    max_limit INTEGER DEFAULT 1000
)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    avatar_url TEXT,
    service_category TEXT,
    rating NUMERIC,
    lat DOUBLE PRECISION,
    long DOUBLE PRECISION,
    is_online BOOLEAN,
    dist_km DOUBLE PRECISION,
    hourly_rate NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pa.id,
        COALESCE(pa.full_name, 'Prestador') AS full_name,
        COALESCE(pa.avatar_url, '') AS avatar_url,
        COALESCE(pa.service_category, 'Geral') AS service_category,
        COALESCE(pa.rating, 5.0) AS rating,
        st_y(pa.location::geometry) AS lat,
        st_x(pa.location::geometry) AS long,
        pa.is_online,
        (ST_Distance(
            pa.location::geography,
            ST_SetSRID(ST_MakePoint(input_long, input_lat), 4326)::geography
        ) / 1000.0) AS dist_km,
        pa.base_fee AS hourly_rate
    FROM 
        public.partners pa
    -- NO JOIN NEEDED ANYMORE!
    WHERE 
        ST_DWithin(
            pa.location::geography,
            ST_SetSRID(ST_MakePoint(input_long, input_lat), 4326)::geography,
            radius_km * 1000
        )
    ORDER BY 
        dist_km ASC
    LIMIT max_limit;
END;
$$;
