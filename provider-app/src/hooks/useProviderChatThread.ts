import { useAuth } from '@/context/AuthContext';
import {
    fetchProviderChatThread,
    markProviderChatThreadAsRead,
    sendProviderChatMessage,
} from '@/services/providerChatService';
import { supabase } from '@/services/supabase';
import { toErrorMessage } from '@/utils/error';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export function useProviderChatThread(requestId?: string) {
    const { user } = useAuth();
    const providerId = user?.id;
    const queryClient = useQueryClient();
    const threadQueryKey = ['provider_chat_thread', providerId, requestId];

    const query = useQuery({
        queryKey: threadQueryKey,
        queryFn: () => fetchProviderChatThread(providerId!, requestId!),
        enabled: !!providerId && !!requestId,
        staleTime: 10 * 1000,
        refetchInterval: 6 * 1000,
    });

    const sendMutation = useMutation({
        mutationFn: async (text: string) => {
            if (!providerId || !requestId) {
                throw new Error('Sessão inválida para envio de mensagem.');
            }
            await sendProviderChatMessage(providerId, requestId, text);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['provider_chat_thread', providerId, requestId] });
            queryClient.invalidateQueries({ queryKey: ['provider_chat_inbox', providerId] });
        },
    });

    useEffect(() => {
        if (!providerId || !requestId || !query.data?.messages?.length) return;

        markProviderChatThreadAsRead(providerId, requestId)
            .then(() => {
                queryClient.invalidateQueries({ queryKey: ['provider_chat_thread', providerId, requestId] });
                queryClient.invalidateQueries({ queryKey: ['provider_chat_inbox', providerId] });
            })
            .catch(() => {
                // read sync failure should not block chat usage
            });
    }, [providerId, query.data?.messages?.length, queryClient, requestId]);

    useEffect(() => {
        if (!providerId || !requestId) return;

        const notificationsChannel = supabase
            .channel(`provider_chat_thread_notifications_${requestId}_${providerId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${providerId}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['provider_chat_thread', providerId, requestId] });
                    queryClient.invalidateQueries({ queryKey: ['provider_chat_inbox', providerId] });
                }
            )
            .subscribe();

        const requestChannel = supabase
            .channel(`provider_chat_thread_request_${requestId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'requests',
                    filter: `id=eq.${requestId}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['provider_chat_thread', providerId, requestId] });
                    queryClient.invalidateQueries({ queryKey: ['provider_chat_inbox', providerId] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(notificationsChannel);
            supabase.removeChannel(requestChannel);
        };
    }, [providerId, queryClient, requestId]);

    return {
        thread: query.data?.thread || null,
        messages: query.data?.messages || [],
        loading: query.isLoading,
        error: query.error ? toErrorMessage(query.error, 'Erro ao carregar conversa.') : null,
        sending: sendMutation.isPending,
        sendMessage: async (text: string) => sendMutation.mutateAsync(text),
        refetch: query.refetch,
    };
}
