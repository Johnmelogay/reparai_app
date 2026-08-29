/**
 * Hook: useOpenRequests
 * Fetches nearby open requests (status = 'finding') for the provider.
 * Uses Supabase Realtime to listen for new requests.
 */
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import { OpenRequest } from '@/types';
import { toErrorMessage } from '@/utils/error';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

async function fetchOpenRequests(): Promise<OpenRequest[]> {
    const { data, error } = await supabase.rpc('get_provider_open_requests', {
        input_radius_km: 5,
        input_limit: 50,
    });

    if (error) throw error;

    const rows = (data || []) as OpenRequest[];
    console.log('[useOpenRequests] fetched nearby requests:', rows.length);
    return rows;
}

export function useOpenRequests() {
    const { user } = useAuth();
    const userId = user?.id;
    const queryClient = useQueryClient();
    const queryKey = ['open_requests', userId];

    const {
        data: requests = [],
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey,
        queryFn: fetchOpenRequests,
        enabled: !!userId,
        staleTime: 60 * 1000,
    });

    // Realtime: listen for new requests being inserted with status 'finding'
    useEffect(() => {
        if (!userId) return;

        const invalidate = () => queryClient.invalidateQueries({ queryKey: ['open_requests', userId] });

        const channel = supabase
            .channel(`open_requests_realtime_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'requests',
                },
                () => {
                    invalidate();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'provider_offers',
                },
                () => {
                    invalidate();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, userId]);

    return {
        requests,
        loading: isLoading,
        error: isError ? toErrorMessage(error, 'Erro ao carregar pedidos') : null,
        refetch,
    };
}
