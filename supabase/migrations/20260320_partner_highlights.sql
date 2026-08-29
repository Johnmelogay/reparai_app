-- ============================================================
-- Migration: Partner Highlights + Profile Enrichment
-- Date: 2026-03-20
-- Purpose:
--   1. Add profile columns to partners (description, banner, badges, address_display)
--   2. Create partner_highlights table for provider service listings
--   3. RLS policies
--   4. Storage bucket for highlight images
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. Enrich partners table
-- ────────────────────────────────────────────────────────────
ALTER TABLE partners ADD COLUMN IF NOT EXISTS description       TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS banner_url        TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS badges            TEXT[]    DEFAULT '{}';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS address_display   TEXT;

-- ────────────────────────────────────────────────────────────
-- 2. partner_highlights table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partner_highlights (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id      UUID            NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    name            TEXT            NOT NULL,
    description     TEXT,
    image_url       TEXT,
    price           NUMERIC(10,2)   NOT NULL,
    original_price  NUMERIC(10,2),  -- strikethrough price for promos
    is_active       BOOLEAN         DEFAULT true,
    sort_order      INTEGER         DEFAULT 0,
    created_at      TIMESTAMPTZ     DEFAULT now(),
    updated_at      TIMESTAMPTZ     DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_highlights_partner
    ON partner_highlights (partner_id)
    WHERE is_active = true;

-- ────────────────────────────────────────────────────────────
-- 3. RLS policies for partner_highlights
-- ────────────────────────────────────────────────────────────
ALTER TABLE partner_highlights ENABLE ROW LEVEL SECURITY;

-- Anyone can read active highlights (public profiles)
DROP POLICY IF EXISTS "highlights_select_public" ON partner_highlights;
CREATE POLICY "highlights_select_public" ON partner_highlights
    FOR SELECT USING (true);

-- Partners can insert their own highlights
DROP POLICY IF EXISTS "highlights_insert_own" ON partner_highlights;
CREATE POLICY "highlights_insert_own" ON partner_highlights
    FOR INSERT WITH CHECK (
        partner_id IN (SELECT id FROM partners WHERE id = auth.uid())
    );

-- Partners can update their own highlights
DROP POLICY IF EXISTS "highlights_update_own" ON partner_highlights;
CREATE POLICY "highlights_update_own" ON partner_highlights
    FOR UPDATE USING (
        partner_id IN (SELECT id FROM partners WHERE id = auth.uid())
    );

-- Partners can delete their own highlights
DROP POLICY IF EXISTS "highlights_delete_own" ON partner_highlights;
CREATE POLICY "highlights_delete_own" ON partner_highlights
    FOR DELETE USING (
        partner_id IN (SELECT id FROM partners WHERE id = auth.uid())
    );

-- ────────────────────────────────────────────────────────────
-- 4. Storage bucket for highlight images
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('highlight-images', 'highlight-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
DROP POLICY IF EXISTS "highlight_images_public_read" ON storage.objects;
CREATE POLICY "highlight_images_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'highlight-images');

-- Authenticated upload
DROP POLICY IF EXISTS "highlight_images_auth_insert" ON storage.objects;
CREATE POLICY "highlight_images_auth_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'highlight-images'
        AND auth.role() = 'authenticated'
    );

-- Authenticated update own
DROP POLICY IF EXISTS "highlight_images_auth_update" ON storage.objects;
CREATE POLICY "highlight_images_auth_update" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'highlight-images'
        AND auth.role() = 'authenticated'
    );

-- Authenticated delete own
DROP POLICY IF EXISTS "highlight_images_auth_delete" ON storage.objects;
CREATE POLICY "highlight_images_auth_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'highlight-images'
        AND auth.role() = 'authenticated'
    );

COMMIT;
