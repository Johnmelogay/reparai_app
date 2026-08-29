-- ============================================================
-- REPARAÍ — Maintenance / Test Data Cleanup Script
-- File: scripts/maintenance/cleanup_test_data_20260829.sql
-- Purpose:
--   1. Expire stale test requests safely (conditional trigger check)
--   2. Fix review roles idempotently based on requests relationship
--   3. Purely data cleanup: no schema alterations or seed data
-- ============================================================

BEGIN;

-- 1. Conditionally disable status transition triggers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.requests'::regclass
      AND tgname = 'trg_enforce_request_rules'
  ) THEN
    ALTER TABLE public.requests DISABLE TRIGGER trg_enforce_request_rules;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.requests'::regclass
      AND tgname = 'enforce_request_rules'
  ) THEN
    ALTER TABLE public.requests DISABLE TRIGGER enforce_request_rules;
  END IF;
END;
$$;

-- 2. Expire stale test requests created before August 2026
UPDATE public.requests
SET status = 'expired', updated_at = NOW()
WHERE status NOT IN ('canceled', 'declined', 'expired', 'done', 'completed')
  AND created_at < '2026-08-01'::timestamptz;

-- 3. Conditionally re-enable status transition triggers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.requests'::regclass
      AND tgname = 'trg_enforce_request_rules'
  ) THEN
    ALTER TABLE public.requests ENABLE TRIGGER trg_enforce_request_rules;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.requests'::regclass
      AND tgname = 'enforce_request_rules'
  ) THEN
    ALTER TABLE public.requests ENABLE TRIGGER enforce_request_rules;
  END IF;
END;
$$;

-- 4. Idempotent review roles correction based on actual request participant roles
UPDATE public.reviews r
SET role = CASE
    WHEN r.reviewee_id = req.provider_id THEN 'provider'
    WHEN r.reviewee_id = req.user_id THEN 'client'
    ELSE r.role
END
FROM public.requests req
WHERE r.request_id = req.id;

COMMIT;
