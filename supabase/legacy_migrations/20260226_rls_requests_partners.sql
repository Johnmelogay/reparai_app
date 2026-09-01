-- ===========================================================
-- RLS Policy GAPS — Fill missing policies on live Supabase
-- ===========================================================
-- Source of truth: queried live schema on 2026-02-26
-- Tables already configured: requests (partial), partners (partial),
-- clients, notifications, provider_offers, base_questions, domains,
-- assets, service_types, partner_specializations, item_options
--
-- This migration adds ONLY the missing policies.
-- ===========================================================

-- =====================
-- 1. REQUESTS — add provider access
-- =====================
-- Gap: providers assigned to a request can't see or update it

-- Policy: Providers can view requests assigned to them
CREATE POLICY "Providers can select assigned requests"
    ON public.requests
    FOR SELECT
    USING (auth.uid() = provider_id);

-- Policy: Providers can update requests assigned to them (accept, complete, etc.)
CREATE POLICY "Providers can update assigned requests"
    ON public.requests
    FOR UPDATE
    USING (auth.uid() = provider_id);

-- =====================
-- 2. PARTNERS — add self-update
-- =====================
-- Gap: partners can't update their own profile (only public read exists)

CREATE POLICY "Partners can update own profile"
    ON public.partners
    FOR UPDATE
    USING (auth.uid() = id);

-- =====================
-- 3. CLIENTS — add insert for new signups
-- =====================
-- Gap: handle_new_user() trigger runs as SECURITY DEFINER so it
-- bypasses RLS. But if any client-side code tries to insert directly, 
-- it would fail. Adding a safe insert policy.

CREATE POLICY "Users can insert own client record"
    ON public.clients
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- =====================
-- 4. ORDERS — legacy table, enable RLS and lock down
-- =====================
-- This table is not used by the app (only referenced in comments).
-- Enable RLS with no permissive policies = effectively blocks all access.
-- Can be safely dropped in a future migration.

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Minimal owner-based policy in case it's ever used
CREATE POLICY "Users can view own orders"
    ON public.orders
    FOR SELECT
    USING (auth.uid() = user_id);
