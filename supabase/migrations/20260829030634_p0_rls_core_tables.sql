-- Migration: 20260829000300_p0_rls_core_tables.sql
-- Description: Patch Atômico 1 - Hardening de RLS e Grants para provider_offers, notifications, reviews e partner_highlights

BEGIN;

-- =============================================================================
-- A. TABELA: provider_offers
-- =============================================================================

-- 1. Habilitar RLS
ALTER TABLE public.provider_offers ENABLE ROW LEVEL SECURITY;

-- 2. Revogar privilégios diretos e conceder estritamente SELECT a authenticated
REVOKE ALL ON public.provider_offers FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.provider_offers TO authenticated;

-- 3. Policies de SELECT (Prestador dono da oferta OU Cliente dono do pedido)
DROP POLICY IF EXISTS "provider_offers_select_provider" ON public.provider_offers;
CREATE POLICY "provider_offers_select_provider" ON public.provider_offers
  FOR SELECT TO authenticated
  USING (provider_id = auth.uid());

DROP POLICY IF EXISTS "provider_offers_select_client" ON public.provider_offers;
CREATE POLICY "provider_offers_select_client" ON public.provider_offers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = provider_offers.request_id
        AND r.user_id = auth.uid()
    )
  );

-- 4. Inclusão idempotente na publication supabase_realtime (sem alterar REPLICA IDENTITY)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'provider_offers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_offers;
  END IF;
END $$;


-- =============================================================================
-- B. TABELA: notifications
-- =============================================================================

-- 1. Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Revogar acesso amplo e conceder estritamente SELECT e UPDATE(is_read) a authenticated
REVOKE ALL ON public.notifications FROM anon, authenticated, PUBLIC;
GRANT SELECT, UPDATE (is_read) ON public.notifications TO authenticated;

-- 3. Policies de acesso
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own_is_read" ON public.notifications;
CREATE POLICY "notifications_update_own_is_read" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Inclusão idempotente na publication supabase_realtime (sem alterar REPLICA IDENTITY)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;


-- =============================================================================
-- C. TABELA: reviews
-- =============================================================================

-- 1. Remover especificamente a policy reviews_insert
DROP POLICY IF EXISTS "reviews_insert" ON public.reviews;

-- 2. Revogar todos os privilégios e conceder exclusivamente SELECT a authenticated
REVOKE ALL ON public.reviews FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.reviews TO authenticated;


-- =============================================================================
-- D. TABELA: partner_highlights
-- =============================================================================

-- 1. Habilitar RLS
ALTER TABLE public.partner_highlights ENABLE ROW LEVEL SECURITY;

-- 2. Revogar privilégios de anon e PUBLIC; conceder CRUD a authenticated (regulado por RLS)
REVOKE ALL ON public.partner_highlights FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_highlights TO authenticated;

-- 3. Policy de SELECT: highlights ativos OU registros pertencentes ao próprio parceiro
DROP POLICY IF EXISTS "highlights_select_active_or_own" ON public.partner_highlights;
CREATE POLICY "highlights_select_active_or_own" ON public.partner_highlights
  FOR SELECT TO authenticated
  USING (
    is_active = true
    OR partner_id = auth.uid()
  );

-- 4. Policy de INSERT: apenas prestadores existentes criando seus próprios registros
DROP POLICY IF EXISTS "highlights_insert_own_partner" ON public.partner_highlights;
CREATE POLICY "highlights_insert_own_partner" ON public.partner_highlights
  FOR INSERT TO authenticated
  WITH CHECK (
    partner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.partners p
      WHERE p.id = auth.uid()
    )
  );

-- 5. Policy de UPDATE: apenas o próprio parceiro pode atualizar suas linhas
DROP POLICY IF EXISTS "highlights_update_own_partner" ON public.partner_highlights;
CREATE POLICY "highlights_update_own_partner" ON public.partner_highlights
  FOR UPDATE TO authenticated
  USING (partner_id = auth.uid())
  WITH CHECK (partner_id = auth.uid());

-- 6. Policy de DELETE: apenas o próprio parceiro pode deletar suas linhas
DROP POLICY IF EXISTS "highlights_delete_own_partner" ON public.partner_highlights;
CREATE POLICY "highlights_delete_own_partner" ON public.partner_highlights
  FOR DELETE TO authenticated
  USING (partner_id = auth.uid());

COMMIT;
