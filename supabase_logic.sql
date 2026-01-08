-- 1. The Trigger Function
-- This function runs automatically whenever a partner is inserted or updated.
-- path: Database > Functions > handle_provider_type_assignment
CREATE OR REPLACE FUNCTION public.handle_provider_type_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Logic: If category is 'auto' (Oficina), it's FIXED. Otherwise, it's MOBILE.
  IF NEW.service_category = 'auto' THEN
    NEW.type := 'FIXED';
  ELSE
    -- Enforce MOBILE for all other categories to ensure consistency
    NEW.type := 'MOBILE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. The Trigger Itself
-- This binds the function above to the 'partners' table.
-- path: Database > Triggers > on_partner_created_or_updated_type
-- (Or via Table Editor > partners > Triggers)
CREATE TRIGGER on_partner_created_or_updated_type
BEFORE INSERT OR UPDATE OF service_category ON public.partners
FOR EACH ROW
EXECUTE FUNCTION public.handle_provider_type_assignment();

-- 3. The RPC Function for Stores
-- This fetches all 'FIXED' providers.
-- path: Database > Functions > get_all_stores
CREATE OR REPLACE FUNCTION public.get_all_stores()
RETURNS TABLE(
  id uuid,
  full_name text,
  avatar_url text,
  service_category text,
  rating numeric,
  base_fee numeric,
  price_per_distance numeric,
  is_online boolean,
  lat double precision,
  long double precision,
  operational_score integer
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    pr.full_name,
    pr.avatar_url,
    p.service_category,
    p.rating,
    p.base_fee,
    p.price_per_distance,
    p.is_online,
    ST_Y(p.location::geometry) as lat, -- Extracts Latitude from PostGIS
    ST_X(p.location::geometry) as long, -- Extracts Longitude from PostGIS
    p.operational_score
  FROM
    partners p
  JOIN
    profiles pr ON p.id = pr.id
  WHERE
    p.type = 'FIXED'  -- Strictly filters by the new 'type' column
    AND p.is_online = true
  ORDER BY
    pr.full_name ASC;
END;
$$;
