import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import { toErrorMessage } from '@/utils/error';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export interface ProviderServiceItem {
    id: string;
    user_id: string;
    status: string;
    category: string | null;
    user_text: string | null;
    address: string | null;
    displacement_fee: number | null;
    created_at: string;
    updated_at: string;
    client_name: string | null;
    client_avatar: string | null;
    done_provider_at: string | null;
    done_client_at: string | null;
}

const IN_PROGRESS_STATUSES = ['accepted', 'paid', 'en_route'];
const DONE_STATUSES = ['done', 'completed', 'canceled'];
const ALLOWED_STATUSES = new Set([...IN_PROGRESS_STATUSES, ...DONE_STATUSES]);

function normalizeStatus(status: string | null | undefined): string {
    return (status || '').toLowerCase().trim();
}

async function fetchProviderServices(providerId: string): Promise<ProviderServiceItem[]> {
    const { data, error } = await supabase
        .from('requests')
        .select(`
            id,
            status,
            category,
            user_text,
            address,
            displacement_fee,
            created_at,
            updated_at,
            user_id,
            done_provider_at,
            done_client_at,
            clients:user_id (
                full_name,
                avatar_url
            )
        `)
        .eq('provider_id', providerId)
        .order('updated_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        status: normalizeStatus(row.status),
        category: row.category,
        user_text: row.user_text,
        address: row.address,
        displacement_fee: row.displacement_fee,
        created_at: row.created_at,
        updated_at: row.updated_at,
        client_name: row.clients?.full_name || null,
        client_avatar: row.clients?.avatar_url || null,
        done_provider_at: row.done_provider_at || null,
        done_client_at: row.done_client_at || null,
    })).filter((row: ProviderServiceItem) => ALLOWED_STATUSES.has(row.status));
}

export function useProviderServices() {
    const { user } = useAuth();
    const providerId = user?.id;
    const queryClient = useQueryClient();
    const queryKey = ['provider_services', providerId];

    const query = useQuery({
        queryKey,
        queryFn: () => fetchProviderServices(providerId!),
        enabled: !!providerId,
        staleTime: 30 * 1000,
        refetchInterval: 8 * 1000,
    });

    useEffect(() => {
        if (!providerId) return;

        const channel = supabase
            .channel(`provider_services_${providerId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'requests',
                    filter: `provider_id=eq.${providerId}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['provider_services', providerId] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [providerId, queryClient]);

    const all = query.data || [];

    return {
        inProgress: all.filter((item) => IN_PROGRESS_STATUSES.includes(item.status)),
        done: all.filter((item) => DONE_STATUSES.includes(item.status)),
        loading: query.isLoading,
        error: query.error ? toErrorMessage(query.error, 'Erro ao carregar serviços.') : null,
        refetch: query.refetch,
    };
}
