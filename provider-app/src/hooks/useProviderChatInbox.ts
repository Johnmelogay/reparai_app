import { useAuth } from '@/context/AuthContext';
import { fetchProviderChatInbox } from '@/services/providerChatService';
import { supabase } from '@/services/supabase';
import { toErrorMessage } from '@/utils/error';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export function useProviderChatInbox() {
    const { user } = useAuth();
    const providerId = user?.id;
    const queryClient = useQueryClient();
    const queryKey = ['provider_chat_inbox', providerId];

    const query = useQuery({
        queryKey,
        queryFn: () => fetchProviderChatInbox(providerId!),
        enabled: !!providerId,
        staleTime: 30 * 1000,
        refetchInterval: 8 * 1000,
    });

    useEffect(() => {
        if (!providerId) return;

        const invalidate = () => queryClient.invalidateQueries({ queryKey: ['provider_chat_inbox', providerId] });

        const notificationsChannel = supabase
            .channel(`provider_chat_inbox_notifications_${providerId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${providerId}`,
                },
                invalidate
            )
            .subscribe();

        const requestsChannel = supabase
            .channel(`provider_chat_inbox_requests_${providerId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'requests',
                    filter: `provider_id=eq.${providerId}`,
                },
                invalidate
            )
            .subscribe();

        return () => {
            supabase.removeChannel(notificationsChannel);
            supabase.removeChannel(requestsChannel);
        };
    }, [providerId, queryClient]);

    return {
        threads: query.data || [],
        loading: query.isLoading,
        error: query.error ? toErrorMessage(query.error, 'Erro ao carregar conversas.') : null,
        refetch: query.refetch,
    };
}
