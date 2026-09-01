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
import { AppState, Platform } from 'react-native';

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
        staleTime: 30 * 1000,
    });

    // Realtime: listen for open_requests_signal and provider_offers events
    useEffect(() => {
        if (!userId) return;

        const invalidateAndRefetch = () => {
            queryClient.invalidateQueries({ queryKey: ['open_requests', userId] });
            refetch();
        };

        const channel = supabase
            .channel(`open_requests_realtime_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'open_requests_signal',
                },
                () => {
                    invalidateAndRefetch();
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
                    invalidateAndRefetch();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // Reconcile any events missed while subscribing
                    refetch();
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, userId, refetch]);

    // AppState focus refetch (native)
    useEffect(() => {
        const sub = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                refetch();
            }
        });
        return () => sub.remove();
    }, [refetch]);

    // Web document visibility change refetch
    useEffect(() => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return;
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                refetch();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [refetch]);

    return {
        requests,
        loading: isLoading,
        error: isError ? toErrorMessage(error, 'Erro ao carregar pedidos') : null,
        refetch,
    };
}
