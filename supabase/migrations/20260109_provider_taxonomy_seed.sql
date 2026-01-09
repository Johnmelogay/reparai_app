-- Migration: Partner Mock Data with 3D Taxonomy Specializations
-- Created: 2026-01-09
-- Purpose: Populate realistic partner data with multidimensional specializations
-- NOTE: This table is now called 'partners', not 'providers'

-- ============================================
-- MOCK PARTNERS WITH TAXONOMY
-- ============================================
-- This migration will only work if there are partners already in the database
-- If no partners exist, these inserts will simply do nothing (ON CONFLICT DO NOTHING)

-- Generic Auto Services Partner (Mobilidade - Carro)
INSERT INTO public.partner_specializations (partner_id, domain_slug, asset_slug, service_type_slug)
SELECT  
    id,
    'mobilidade',
    'carro',
    'mecanica'
FROM public.partners
LIMIT 1
ON CONFLICT DO NOTHING;

-- Casa - AR Partner
INSERT INTO public.partner_specializations (partner_id, domain_slug, asset_slug, service_type_slug)
SELECT  
    id,
    'casa',
    'ar_condicionado',
    'manutencao'
FROM public.partners
LIMIT 1
ON CONFLICT DO NOTHING;

-- Hydráulica Partner (All water-related assets)
INSERT INTO public.partner_specializations (partner_id, domain_slug, asset_slug, service_type_slug)
SELECT  
    id,
    'casa',
    'pia',
    'hidraulica'
FROM public.partners
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.partner_specializations (partner_id, domain_slug, asset_slug, service_type_slug)
SELECT  
    id,
    'casa',
    'chuveiro',
    'hidraulica'
FROM public.partners
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.partner_specializations (partner_id, domain_slug, asset_slug, service_type_slug)
SELECT  
    id,
    'casa',
    'vaso',
   'hidraulica'
FROM public.partners
LIMIT 1
ON CONFLICT DO NOTHING;

-- Tech Partner (Tecnologia)
INSERT INTO public.partner_specializations (partner_id, domain_slug, asset_slug, service_type_slug)
SELECT  
    id,
    'tecnologia',
    'tv',
    'diagnostico'
FROM public.partners
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.partner_specializations (partner_id, domain_slug, asset_slug, service_type_slug)
SELECT  
    id,
    'tecnologia',
    'notebook',
    'manutencao'
FROM public.partners
LIMIT 1
ON CONFLICT DO NOTHING;

-- Eletricista Geral (Casa - Generic for all electrical)
INSERT INTO public.partner_specializations (partner_id, domain_slug, asset_slug, service_type_slug)
SELECT  
    id,
    'casa',
    NULL, -- NULL asset_slug means accepts all assets in 'casa' domain
    'eletrica'
FROM public.partners
LIMIT 1
ON CONFLICT DO NOTHING;

-- Bike Mechanic (Mobilidade - Specialized)
INSERT INTO public.partner_specializations (partner_id, domain_slug, asset_slug, service_type_slug)
SELECT  
    id,
    'mobilidade',
    'bicicleta',
    'mecanica'
FROM public.partners
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.partner_specializations (partner_id, domain_slug, asset_slug, service_type_slug)
SELECT  
    id,
    'mobilidade',
    'patinete',
    'mecanica'
FROM public.partners
LIMIT 1
ON CONFLICT DO NOTHING;
