-- ===========================================================
-- Provider Visibility + Realtime Hardening
-- Created: 2026-03-18
-- Purpose:
-- 1) Guarantee provider can read assigned request history/chat rows
-- 2) Guarantee provider can read client profile for assigned requests
-- 3) Guarantee realtime publication includes core matching/chat tables
-- ===========================================================

-- -----------------------------------------------------------
-- 1) Defensive grants (RLS still applies)
-- -----------------------------------------------------------
GRANT SELECT, UPDATE ON TABLE public.requests TO authenticated;
GRANT SELECT ON TABLE public.clients TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.notifications TO authenticated;

-- -----------------------------------------------------------
-- 2) Ensure RLS policy for provider assigned requests
-- -----------------------------------------------------------
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'requests'
      AND policyname = 'Providers can select assigned requests'
  ) THEN
    CREATE POLICY "Providers can select assigned requests"
      ON public.requests
      FOR SELECT
      USING (auth.uid() = provider_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'requests'
      AND policyname = 'Providers can update assigned requests'
  ) THEN
    CREATE POLICY "Providers can update assigned requests"
      ON public.requests
      FOR UPDATE
      USING (auth.uid() = provider_id)
      WITH CHECK (auth.uid() = provider_id);
  END IF;
END;
$$;

-- -----------------------------------------------------------
-- 3) Allow providers to read client profile linked to assigned request
-- -----------------------------------------------------------
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clients'
      AND policyname = 'Providers can read clients on assigned requests'
  ) THEN
    CREATE POLICY "Providers can read clients on assigned requests"
      ON public.clients
      FOR SELECT
      USING (
        auth.uid() = id
        OR EXISTS (
          SELECT 1
          FROM public.requests r
          WHERE r.user_id = clients.id
            AND r.provider_id = auth.uid()
        )
      );
  END IF;
END;
$$;

-- -----------------------------------------------------------
-- 4) Ensure realtime publication for live feeds
-- -----------------------------------------------------------
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

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'provider_offers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_offers;
  END IF;
END;
$$;

