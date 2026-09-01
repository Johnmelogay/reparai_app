-- ===========================================================
-- Trigger Fix: allow 'offered' status transitions
-- Created: 2026-03-18
-- ===========================================================

CREATE OR REPLACE FUNCTION public.enforce_request_rules()
RETURNS trigger AS $$
declare
  v_choose_provider text;
begin
  -- Status transition rules
  if new.status is distinct from old.status then
    -- Treat terminal statuses as final
    if old.status in ('declined','canceled','expired','done') then
      raise exception 'cannot change terminal status';
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
    if old.status = 'en_route' and new.status not in ('done','canceled') then
      raise exception 'invalid transition from en_route';
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
