-- Migration: Deterministic Partner Matching Function (3D Taxonomy)
-- Created: 2026-01-09
-- Purpose: Replace AI-based matching with efficient geo + capability filtering + scoring

-- ============================================
-- DETERMINISTIC MATCHING FUNCTION
-- ============================================
-- This function implements a 3-layer approach:
-- 1. GEO FILTER: PostGIS radius (fast)
-- 2. CAPABILITY FILTER: asset_type + service_type + issue_tags match
-- 3. RANKING: score based on distance, rating, availability, price

CREATE OR REPLACE FUNCTION public.find_matching_partners(
    request_lat DOUBLE PRECISION,
    request_lng DOUBLE PRECISION,
    request_domain TEXT,
    request_asset TEXT,
    request_service TEXT,
    request_tags TEXT[],
    radius_km INTEGER DEFAULT 15,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    partner_id UUID,
    partner_name TEXT,
    distance_km NUMERIC,
    rating NUMERIC,
    review_count INTEGER,
    match_score NUMERIC,
    specialization_match_count INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH geo_filtered AS (
        -- LAYER 1: GEO FILTER (fast PostGIS)
        SELECT 
            p.id,
            p.name,
            p.rating,
            p.reviews,
            p.location,
            ST_Distance(
                p.location::geography,
                ST_SetSRID(ST_MakePoint(request_lng, request_lat), 4326)::geography
            ) / 1000.0 AS distance
        FROM public.partners p
        WHERE p.is_active = true
          AND ST_DWithin(
              p.location::geography,
              ST_SetSRID(ST_MakePoint(request_lng, request_lat), 4326)::geography,
              radius_km * 1000  -- Convert km to meters
          )
    ),
    capability_matched AS (
        -- LAYER 2: CAPABILITY FILTER
        SELECT 
            gf.id,
            gf.name,
            gf.rating,
            gf.reviews,
            gf.distance,
            COUNT(ps.id) FILTER (
                WHERE (ps.domain_slug = request_domain OR ps.domain_slug IS NULL)
                  AND (ps.asset_slug = request_asset OR ps.asset_slug IS NULL)
                  AND (ps.service_type_slug = request_service OR ps.service_type_slug IS NULL)
            ) AS spec_match_count
        FROM geo_filtered gf
        LEFT JOIN public.partner_specializations ps ON ps.partner_id = gf.id
        GROUP BY gf.id, gf.name, gf.rating, gf.reviews, gf.distance
        HAVING COUNT(ps.id) FILTER (
            WHERE (ps.domain_slug = request_domain OR ps.domain_slug IS NULL)
              AND (ps.asset_slug = request_asset OR ps.asset_slug IS NULL)
              AND (ps.service_type_slug = request_service OR ps.service_type_slug IS NULL)
        ) > 0  -- Must have at least 1 matching specialization
    )
    -- LAYER 3: RANKING (weighted score)
    SELECT 
        cm.id AS partner_id,
        cm.name AS partner_name,
        ROUND(cm.distance::NUMERIC, 2) AS distance_km,
        COALESCE(cm.rating, 0) AS rating,
        COALESCE(cm.reviews, 0) AS review_count,
        -- WEIGHTED SCORE FORMULA:
        -- - Specialization match: 40 points
        -- - Distance: 30 points (closer = better)
        -- - Rating: 20 points
        -- - Review count: 10 points (credibility)
        ROUND(
            (cm.spec_match_count * 10.0) +                           -- 10 pts per match (max 40)
            (30.0 * (1.0 - LEAST(cm.distance / (radius_km * 1.0), 1.0))) +  -- Distance score (max 30)
            (COALESCE(cm.rating, 0.0) * 4.0) +                       -- Rating score (max 20)
            (LEAST(COALESCE(cm.reviews, 0), 100) / 10.0)             -- Review credibility (max 10)
        , 2) AS match_score,
        cm.spec_match_count::INTEGER AS specialization_match_count
    FROM capability_matched cm
    ORDER BY match_score DESC, cm.distance ASC
    LIMIT max_results;
END;
$$;

-- ============================================
-- EXAMPLE USAGE
-- ============================================
-- SELECT * FROM find_matching_partners(
--     -8.7650,        -- latitude
--     -63.9000,       -- longitude
--     'mobilidade',   -- domain
--     'bicicleta',    -- asset_type
--     'mecanica',     -- service_type
--     ARRAY['corrente', 'folga'],  -- issue_tags
--     15,             -- radius_km
--     10              -- max_results
-- );
