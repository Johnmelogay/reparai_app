-- Migration: Get Map Partners (Optimized)
-- Created: 2026-01-09
-- Purpose: Efficiently fetch partners for the map with high limits and basic info only

CREATE OR REPLACE FUNCTION public.get_map_partners(
    input_lat DOUBLE PRECISION,
    input_long DOUBLE PRECISION,
    radius_km INTEGER DEFAULT 50,
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
    type TEXT,
    dist_km DOUBLE PRECISION,
    base_fee NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name AS full_name,
        p.image AS avatar_url,
        p.category AS service_category,
        COALESCE(p.rating, 5.0) AS rating,
        (p.location->>'lat')::DOUBLE PRECISION AS lat,
        (p.location->>'long')::DOUBLE PRECISION AS long,
        p.is_active AS is_online, -- Assuming is_active maps to online logic or similar
        'PROVIDER' AS type,       -- Simplification, can distinguish if needed
        (ST_Distance(
            p.location::geography,
            ST_SetSRID(ST_MakePoint(input_long, input_lat), 4326)::geography
        ) / 1000.0) AS dist_km,
        p.hourly_rate AS base_fee
    FROM 
        public.profiles p -- Assuming 'profiles' acts as providers now or 'partners'
    WHERE 
        p.role = 'provider' -- Filter for providers only
        AND ST_DWithin(
            p.location::geography,
            ST_SetSRID(ST_MakePoint(input_long, input_lat), 4326)::geography,
            radius_km * 1000
        )
    ORDER BY 
        dist_km ASC
    LIMIT max_limit;
END;
$$;
