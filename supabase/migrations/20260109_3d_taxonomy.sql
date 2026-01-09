-- Migration: 3D Taxonomy (Domínio → Asset → Serviço)
-- Created: 2026-01-09
-- Purpose: Replace flat "category" with multidimensional taxonomy

-- ============================================
-- 1. DOMAINS (Domínio - "O Corredor")
-- ============================================
CREATE TABLE IF NOT EXISTS public.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT, -- Emoji or icon name
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. ASSETS (Asset/Objeto - "O Quê")
-- ============================================
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT, -- Emoji or icon name
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_domain ON public.assets(domain_id);

-- ============================================
-- 3. SERVICE TYPES (Tipo de Serviço - "Como")
-- ============================================
CREATE TABLE IF NOT EXISTS public.service_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. ASSET-SERVICE COMPATIBILITY
-- ============================================
-- Define which services are applicable to which assets
CREATE TABLE IF NOT EXISTS public.asset_service_compatibility (
    asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    service_type_id UUID NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (asset_id, service_type_id)
);

-- ============================================
-- 5. UPDATE REQUESTS TABLE
-- ============================================
-- Add new taxonomy fields (keep old category for migration)
ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS domain_slug TEXT,
ADD COLUMN IF NOT EXISTS asset_slug TEXT,
ADD COLUMN IF NOT EXISTS service_type_slug TEXT,
ADD COLUMN IF NOT EXISTS issue_tags TEXT[]; -- Array of issue tags (e.g., corrente, folga)

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_requests_domain ON public.requests(domain_slug);
CREATE INDEX IF NOT EXISTS idx_requests_asset ON public.requests(asset_slug);
CREATE INDEX IF NOT EXISTS idx_requests_service ON public.requests(service_type_slug);

-- ============================================
-- 6. UPDATE PARTNERS TABLE (NOT PROVIDERS)
-- ============================================
-- Partners can now specialize in multiple domain+asset+service combinations
CREATE TABLE IF NOT EXISTS public.partner_specializations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    domain_slug TEXT,
    asset_slug TEXT,
    service_type_slug TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_spec_partner ON public.partner_specializations(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_spec_domain ON public.partner_specializations(domain_slug);
CREATE INDEX IF NOT EXISTS idx_partner_spec_asset ON public.partner_specializations(asset_slug);
CREATE INDEX IF NOT EXISTS idx_partner_spec_service ON public.partner_specializations(service_type_slug);

-- ============================================
-- 7. SEED DATA - DOMAINS
-- ============================================
INSERT INTO public.domains (slug, name, icon, description, display_order) VALUES
('mobilidade', 'Mobilidade', '🚗', 'Veículos e transporte', 1),
('casa', 'Casa', '🏠', 'Residência e infraestrutura', 2),
('tecnologia', 'Tecnologia', '💻', 'Eletrônicos e dispositivos', 3)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 8. SEED DATA - SERVICE TYPES
-- ============================================
INSERT INTO public.service_types (slug, name, description, icon, display_order) VALUES
('mecanica', 'Mecânica', 'Reparos mecânicos, motor, suspensão', '🔧', 1),
('eletrica', 'Elétrica', 'Fiação, tomadas, disjuntores', '⚡', 2),
('hidraulica', 'Hidráulica', 'Vazamentos, entupimentos, encanamento', '💧', 3),
('instalacao', 'Instalação', 'Montar, instalar equipamentos', '🔨', 4),
('manutencao', 'Manutenção', 'Preventiva, limpeza, ajustes', '🛠️', 5),
('diagnostico', 'Diagnóstico', 'Avaliar e identificar problema', '🔍', 6)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 9. SEED DATA - ASSETS (MOBILIDADE)
-- ============================================
INSERT INTO public.assets (domain_id, slug, name, icon, display_order)
SELECT d.id, 'carro', 'Carro', '🚗', 1
FROM public.domains d WHERE d.slug = 'mobilidade'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.assets (domain_id, slug, name, icon, display_order)
SELECT d.id, 'moto', 'Moto', '🏍️', 2
FROM public.domains d WHERE d.slug = 'mobilidade'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.assets (domain_id, slug, name, icon, display_order)
SELECT d.id, 'bicicleta', 'Bicicleta', '🚲', 3
FROM public.domains d WHERE d.slug = 'mobilidade'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.assets (domain_id, slug, name, icon, display_order)
SELECT d.id, 'patinete', 'Patinete', '🛴', 4
FROM public.domains d WHERE d.slug = 'mobilidade'
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 10. SEED DATA - ASSETS (CASA)
-- ============================================
INSERT INTO public.assets (domain_id, slug, name, icon, display_order)
SELECT d.id, 'ar_condicionado', 'Ar Condicionado', '❄️', 1
FROM public.domains d WHERE d.slug = 'casa'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.assets (domain_id, slug, name, icon, display_order)
SELECT d.id, 'geladeira', 'Geladeira', '🧊', 2
FROM public.domains d WHERE d.slug = 'casa'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.assets (domain_id, slug, name, icon, display_order)
SELECT d.id, 'chuveiro', 'Chuveiro', '🚿', 3
FROM public.domains d WHERE d.slug = 'casa'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.assets (domain_id, slug, name, icon, display_order)
SELECT d.id, 'pia', 'Pia', '🚰', 4
FROM public.domains d WHERE d.slug = 'casa'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.assets (domain_id, slug, name, icon, display_order)
SELECT d.id, 'vaso', 'Vaso Sanitário', '🚽', 5
FROM public.domains d WHERE d.slug = 'casa'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.assets (domain_id, slug, name, icon, display_order)
SELECT d.id, 'portao', 'Portão', '🚪', 6
FROM public.domains d WHERE d.slug = 'casa'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.assets (domain_id, slug, name, icon, display_order)
SELECT d.id, 'janela', 'Janela', '🪟', 7
FROM public.domains d WHERE d.slug = 'casa'
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 11. SEED DATA - ASSETS (TECNOLOGIA)
-- ============================================
INSERT INTO public.assets (domain_id, slug, name, icon, display_order)
SELECT d.id, 'tv', 'TV', '📺', 1
FROM public.domains d WHERE d.slug = 'tecnologia'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.assets (domain_id, slug, name, icon, display_order)
SELECT d.id, 'celular', 'Celular', '📱', 2
FROM public.domains d WHERE d.slug = 'tecnologia'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.assets (domain_id, slug, name, icon, display_order)
SELECT d.id, 'notebook', 'Notebook', '💻', 3
FROM public.domains d WHERE d.slug = 'tecnologia'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.assets (domain_id, slug, name, icon, display_order)
SELECT d.id, 'impressora', 'Impressora', '🖨️', 4
FROM public.domains d WHERE d.slug = 'tecnologia'
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 12. SEED DATA - COMPATIBILITY EXAMPLES
-- ============================================
-- Mobilidade assets can have mecanica, eletrica
INSERT INTO public.asset_service_compatibility (asset_id, service_type_id)
SELECT a.id, st.id
FROM public.assets a
CROSS JOIN public.service_types st
WHERE a.slug IN ('carro', 'moto', 'bicicleta', 'patinete')
  AND st.slug IN ('mecanica', 'eletrica', 'manutencao', 'diagnostico')
ON CONFLICT DO NOTHING;

-- Casa - Ar condicionado: instalacao, manutencao, eletrica
INSERT INTO public.asset_service_compatibility (asset_id, service_type_id)
SELECT a.id, st.id
FROM public.assets a
CROSS JOIN public.service_types st
WHERE a.slug = 'ar_condicionado'
  AND st.slug IN ('instalacao', 'manutencao', 'eletrica', 'diagnostico')
ON CONFLICT DO NOTHING;

-- Casa - Hidráulica assets
INSERT INTO public.asset_service_compatibility (asset_id, service_type_id)
SELECT a.id, st.id
FROM public.assets a
CROSS JOIN public.service_types st
WHERE a.slug IN ('chuveiro', 'pia', 'vaso')
  AND st.slug IN ('hidraulica', 'instalacao', 'manutencao', 'diagnostico')
ON CONFLICT DO NOTHING;

-- Tecnologia: diagnostico, manutencao
INSERT INTO public.asset_service_compatibility (asset_id, service_type_id)
SELECT a.id, st.id
FROM public.assets a
CROSS JOIN public.service_types st
WHERE a.domain_id = (SELECT id FROM public.domains WHERE slug = 'tecnologia')
  AND st.slug IN ('diagnostico', 'manutencao', 'eletrica')
ON CONFLICT DO NOTHING;
