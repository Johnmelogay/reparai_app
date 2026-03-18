/**
 * Taxonomy Service
 * Fetches 3D taxonomy data (Domains, Assets, ServiceTypes) from Supabase
 */

import { Asset, Domain, ServiceType } from '@/types';
import { supabase } from './supabase';

/**
 * Fetch all active domains
 */
export async function getDomains(): Promise<Domain[]> {
    const { data, error } = await supabase
        .from('domains')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

    if (error) {
        console.error('Error fetching domains:', error);
        return [];
    }

    return data as Domain[];
}

/**
 * Fetch assets for a specific domain
 */
export async function getAssetsByDomain(domainSlug: string): Promise<Asset[]> {
    const { data: domainData, error: domainError } = await supabase
        .from('domains')
        .select('id')
        .eq('slug', domainSlug)
        .single();

    if (domainError || !domainData) {
        console.error('Error fetching domain:', domainError);
        return [];
    }

    const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('domain_id', domainData.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

    if (error) {
        console.error('Error fetching assets:', error);
        return [];
    }

    return data as Asset[];
}

/**
 * Fetch all service types
 */
export async function getServiceTypes(): Promise<ServiceType[]> {
    const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

    if (error) {
        console.error('Error fetching service types:', error);
        return [];
    }

    return data as ServiceType[];
}

/**
 * Fetch compatible service types for a specific asset
 */
export async function getCompatibleServices(assetSlug: string): Promise<ServiceType[]> {
    // Get asset ID
    const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .select('id')
        .eq('slug', assetSlug)
        .single();

    if (assetError || !assetData) {
        console.error('Error fetching asset:', assetError);
        return [];
    }

    // Get compatible service type IDs
    const { data: compatData, error: compatError } = await supabase
        .from('asset_service_compatibility')
        .select('service_type_id')
        .eq('asset_id', assetData.id);

    if (compatError || !compatData) {
        console.error('Error fetching compatibility:', compatError);
        return [];
    }

    const serviceTypeIds = compatData.map(c => c.service_type_id);

    // Fetch the actual service types
    const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .in('id', serviceTypeIds)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

    if (error) {
        console.error('Error fetching service types:', error);
        return [];
    }

    return data as ServiceType[];
}

/**
 * Mock data for development (fallback if Supabase fails)
 */
export const MOCK_DOMAINS: Domain[] = [
    {
        id: '1',
        slug: 'mobilidade',
        name: 'Mobilidade',
        icon: '🚗',
        description: 'Veículos e transporte',
        displayOrder: 1,
        isActive: true
    },
    {
        id: '2',
        slug: 'casa',
        name: 'Casa',
        icon: '🏠',
        description: 'Residência e infraestrutura',
        displayOrder: 2,
        isActive: true
    },
    {
        id: '3',
        slug: 'tecnologia',
        name: 'Tecnologia',
        icon: '💻',
        description: 'Eletrônicos e dispositivos',
        displayOrder: 3,
        isActive: true
    }
];
