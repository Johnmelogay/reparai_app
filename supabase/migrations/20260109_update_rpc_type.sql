-- Migration: Update RPC to include 'type' column
-- Created: 2026-01-09

DROP FUNCTION IF EXISTS public.get_map_partners_v2(double precision, double precision, integer, integer);

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
    hourly_rate NUMERIC,
    type TEXT
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
        pa.base_fee AS hourly_rate,
        COALESCE(pa.type, 'MOBILE') AS type
    FROM 
        public.partners pa
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
