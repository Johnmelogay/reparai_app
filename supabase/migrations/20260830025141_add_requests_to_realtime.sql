-- Migration: 20260830030000_add_requests_to_realtime.sql
-- Description: Adiciona public.requests à publicação supabase_realtime de forma idempotente para suportar tracking em tempo real no app

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.requests;
  END IF;
END $$;

COMMIT;
