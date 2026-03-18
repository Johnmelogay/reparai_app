import { supabase } from '@/services/supabase';
import { TaxonomyAsset, TaxonomyDomain, TaxonomyServiceType } from '@/types';

export async function fetchDomains(): Promise<TaxonomyDomain[]> {
    const { data, error } = await supabase
        .from('domains')
        .select('id, slug, name')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

    if (error) throw error;
    return (data || []) as TaxonomyDomain[];
}

export async function fetchAssets(): Promise<TaxonomyAsset[]> {
    const { data, error } = await supabase
        .from('assets')
        .select('id, domain_id, slug, name')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

    if (error) throw error;
    return (data || []) as TaxonomyAsset[];
}

export async function fetchServiceTypes(): Promise<TaxonomyServiceType[]> {
    const { data, error } = await supabase
        .from('service_types')
        .select('id, slug, name')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

    if (error) throw error;
    return (data || []) as TaxonomyServiceType[];
}
