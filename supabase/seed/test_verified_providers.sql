-- ============================================================
-- REPARAÍ — Test Seed: Authorize Test Providers
-- File: supabase/seed/test_verified_providers.sql
-- Purpose:
--   Authorize known test provider accounts in dev/staging after DDL migration.
-- ============================================================

BEGIN;

UPDATE public.partners
SET is_verified = true
WHERE id IN (
  '2f8aebf5-bd75-4879-a061-5781710be9a4'::uuid,
  '86a9880c-9007-4982-81f1-77354ca5b0c2'::uuid
);

COMMIT;
