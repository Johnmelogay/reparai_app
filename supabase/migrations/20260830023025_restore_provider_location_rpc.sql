-- Migration: 20260829223000_restore_provider_location_rpc.sql
-- Description: Criação canônica e hardening da RPC set_my_partner_location para sincronização de geolocalização do prestador

BEGIN;

CREATE OR REPLACE FUNCTION public.set_my_partner_location(
  input_lat double precision,
  input_long double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  current_uid UUID := auth.uid();
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF input_lat IS NULL OR input_long IS NULL THEN
    RAISE EXCEPTION 'invalid_coordinates: latitude and longitude cannot be null';
  END IF;

  IF input_lat = 'NaN'::double precision OR input_long = 'NaN'::double precision THEN
    RAISE EXCEPTION 'invalid_coordinates: latitude and longitude cannot be NaN';
  END IF;

  IF input_lat = 'Infinity'::double precision OR input_lat = '-Infinity'::double precision OR
     input_long = 'Infinity'::double precision OR input_long = '-Infinity'::double precision THEN
    RAISE EXCEPTION 'invalid_coordinates: latitude and longitude cannot be infinite';
  END IF;

  IF input_lat < -90.0 OR input_lat > 90.0 THEN
    RAISE EXCEPTION 'invalid_coordinates: latitude must be between -90 and 90';
  END IF;

  IF input_long < -180.0 OR input_long > 180.0 THEN
    RAISE EXCEPTION 'invalid_coordinates: longitude must be between -180 and 180';
  END IF;

  UPDATE public.partners
  SET location = ST_SetSRID(ST_MakePoint(input_long, input_lat), 4326)::geography,
      updated_at = NOW()
  WHERE id = current_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'provider_profile_not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_partner_location(double precision, double precision) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_partner_location(double precision, double precision) TO authenticated;

COMMIT;
