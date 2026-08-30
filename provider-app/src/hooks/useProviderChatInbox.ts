import { useAuth } from '@/context/AuthContext';
import { fetchProviderChatInbox } from '@/services/providerChatService';
import { supabase } from '@/services/supabase';
import { toErrorMessage } from '@/utils/error';
import { useIsFocused } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

export function useProviderChatInbox() {
    const { user } = useAuth();
    const providerId = user?.id;
    const isFocused = useIsFocused();
    const queryClient = useQueryClient();
    const channelIdRef = useRef(Math.random().toString(36).substring(2, 9));
    const queryKey = ['provider_chat_inbox', providerId];

    const query = useQuery({
        queryKey,
        queryFn: () => fetchProviderChatInbox(providerId!),
        enabled: !!providerId,
        staleTime: 10 * 1000,
    });

    // Refetch garantido ao focar na tela de conversas do prestador
    useEffect(() => {
        if (isFocused && providerId) {
            query.refetch();
        }
    }, [isFocused, providerId]);

    useEffect(() => {
        if (!providerId) return;

        const invalidate = () => queryClient.invalidateQueries({ queryKey: ['provider_chat_inbox', providerId] });

        // Escuta novas mensagens na tabela canônica chat_messages com canal isolado
        const chatChannel = supabase
            .channel(`provider_inbox_msgs_${providerId}_${channelIdRef.current}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_messages',
                },
                invalidate
            )
            .subscribe();

        const requestsChannel = supabase
            .channel(`provider_inbox_reqs_${providerId}_${channelIdRef.current}`)
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
            supabase.removeChannel(chatChannel);
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
