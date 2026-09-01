-- ===========================================================
-- Architecture Update: Battery Drain, Payments, Unhappy Paths
-- Created: 2026-06-23
-- ===========================================================

-- 1. Add Push Token to partners
ALTER TABLE public.partners 
ADD COLUMN IF NOT EXISTS push_token text;

-- 2. Add Service Quote and Payment Status to requests
ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS service_quote numeric,
ADD COLUMN IF NOT EXISTS service_payment_status text;

-- 3. Update the Status Constraint
ALTER TABLE public.requests
DROP CONSTRAINT IF EXISTS requests_status_check;

ALTER TABLE public.requests
ADD CONSTRAINT requests_status_check 
CHECK (status = ANY (ARRAY[
  'finding'::text, 
  'offered'::text, 
  'answered'::text, 
  'accepted'::text, 
  'paid'::text, 
  'en_route'::text, 
  'arrived'::text,
  'quote_provided'::text,
  'quote_accepted'::text,
  'done'::text, 
  'declined'::text, 
  'canceled'::text, 
  'expired'::text,
  'disputed'::text
]));

-- 4. Replace the enforce_request_rules trigger function
CREATE OR REPLACE FUNCTION public.enforce_request_rules()
RETURNS trigger AS $$
declare
  v_choose_provider text;
begin
  -- Status transition rules
  if new.status is distinct from old.status then
    -- Treat terminal statuses as final
    -- Allow transition from 'done' to 'disputed' if a problem arises after completion
    if old.status in ('declined','canceled','expired') then
      raise exception 'cannot change terminal status';
    end if;

    if old.status = 'done' and new.status not in ('disputed') then
      raise exception 'invalid transition from done (only to disputed allowed)';
    end if;

    -- Transitions from 'finding'
    if old.status = 'finding' and new.status not in ('offered','answered','accepted','paid','declined','canceled','expired') then
      raise exception 'invalid transition from finding';
    end if;

    -- Transitions from 'offered' or 'answered'
    if old.status in ('offered', 'answered') and new.status not in ('offered', 'answered','accepted','paid','declined','canceled','expired') then
      raise exception 'invalid transition from %', old.status;
    end if;

    -- Transitions from 'accepted'
    if old.status = 'accepted' and new.status not in ('paid','declined','canceled') then
      raise exception 'invalid transition from accepted';
    end if;

    -- Transitions from 'paid'
    if old.status = 'paid' and new.status not in ('en_route','canceled') then
      raise exception 'invalid transition from paid';
    end if;

    -- Transitions from 'en_route'
    if old.status = 'en_route' and new.status not in ('arrived','canceled','done') then
      -- Allow done here for legacy compatibility in case client skips arrive
      raise exception 'invalid transition from en_route';
    end if;

    -- Transitions from 'arrived'
    if old.status = 'arrived' and new.status not in ('quote_provided','canceled','disputed') then
      raise exception 'invalid transition from arrived';
    end if;

    -- Transitions from 'quote_provided'
    if old.status = 'quote_provided' and new.status not in ('quote_accepted','canceled','disputed') then
      raise exception 'invalid transition from quote_provided';
    end if;

    -- Transitions from 'quote_accepted'
    if old.status = 'quote_accepted' and new.status not in ('done','canceled','disputed') then
      raise exception 'invalid transition from quote_accepted';
    end if;

    -- Transitions from 'disputed'
    if old.status = 'disputed' and new.status not in ('done','canceled') then
      raise exception 'invalid transition from disputed';
    end if;

    -- Validation for 'done'
    if new.status = 'done' and (new.done_client_at is null or new.done_provider_at is null) then
      raise exception 'done requires both confirmations';
    end if;
  end if;

  -- Auto-finish when both confirmations exist
  if new.status <> 'done' and new.done_client_at is not null and new.done_provider_at is not null then
    new.status := 'done';
  end if;

  return new;
end $$ LANGUAGE plpgsql;

-- 5. Update find_nearby_providers to include push_token
CREATE OR REPLACE FUNCTION public.find_nearby_providers(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    category_filter TEXT,
    radius_km INT DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    full_name TEXT,
    avatar_url TEXT,
    rating NUMERIC,
    base_fee NUMERIC,
    distance_km DOUBLE PRECISION,
    is_online BOOLEAN,
    push_token TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        pr.full_name,
        pr.avatar_url,
        p.rating,
        p.base_fee,
        ST_Distance(
            p.location::geography,
            ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
        ) / 1000 as distance_km,
        p.is_online,
        p.push_token
    FROM partners p
    JOIN profiles pr ON p.id = pr.id
    WHERE p.service_category = category_filter
      AND p.is_online = true
      AND ST_DWithin(
          p.location::geography,
          ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
          radius_km * 1000
      )
    ORDER BY p.rating DESC, distance_km ASC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;
