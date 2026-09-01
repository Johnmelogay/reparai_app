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
    ST_Y(p.location::geometry) as lat,
    ST_X(p.location::geometry) as long,
    p.operational_score
  FROM
    partners p
  JOIN
    profiles pr ON p.id = pr.id
  WHERE
    p.service_category = 'auto'
    AND p.is_online = true
  ORDER BY
    pr.full_name ASC;
END;
$$;
