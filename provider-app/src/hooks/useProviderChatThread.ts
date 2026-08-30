import { useAuth } from '@/context/AuthContext';
import {
    fetchProviderChatThread,
    markProviderChatThreadAsRead,
    sendProviderChatMessage,
} from '@/services/providerChatService';
import { supabase } from '@/services/supabase';
import { toErrorMessage } from '@/utils/error';
import { useIsFocused } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useEffect, useRef } from 'react';

interface SendMessageVariables {
    requestId: string;
    text: string;
    clientMessageId: string;
}

export function useProviderChatThread(requestId?: string) {
    const { user } = useAuth();
    const providerId = user?.id;
    const isFocused = useIsFocused();
    const queryClient = useQueryClient();
    const isMarkingReadRef = useRef(false);
    const threadQueryKey = ['provider_chat_thread', providerId, requestId];

    const query = useQuery({
        queryKey: threadQueryKey,
        queryFn: () => fetchProviderChatThread(providerId!, requestId!),
        enabled: !!providerId && !!requestId,
        staleTime: 10 * 1000,
    });

    const sendMutation = useMutation({
        mutationFn: async ({ requestId: reqId, text, clientMessageId }: SendMessageVariables) => {
            if (!providerId || !reqId) {
                throw new Error('Sessão inválida para envio de mensagem.');
            }
            return sendProviderChatMessage(reqId, text, clientMessageId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['provider_chat_thread', providerId, requestId] });
            queryClient.invalidateQueries({ queryKey: ['provider_chat_inbox', providerId] });
        },
    });

    // Marcação de leitura acionada quando a tela está em foco e há mensagens não lidas
    useEffect(() => {
        if (!providerId || !requestId || !isFocused || isMarkingReadRef.current) return;

        const hasUnreadIncoming = query.data?.messages?.some(
            (m) => m.direction === 'incoming' && !m.readAt
        );

        if (hasUnreadIncoming) {
            isMarkingReadRef.current = true;
            markProviderChatThreadAsRead(requestId)
                .then((updatedCount) => {
                    if (updatedCount > 0) {
                        queryClient.invalidateQueries({ queryKey: ['provider_chat_thread', providerId, requestId] });
                        queryClient.invalidateQueries({ queryKey: ['provider_chat_inbox', providerId] });
                    }
                })
                .catch(() => {
                    // Falha silenciosa não deve quebrar a experiência
                })
                .finally(() => {
                    isMarkingReadRef.current = false;
                });
        }
    }, [providerId, requestId, isFocused, query.data?.messages, queryClient]);

    // Refetch garantido ao recuperar foco na tela
    useEffect(() => {
        if (isFocused && requestId && providerId) {
            query.refetch();
        }
    }, [isFocused, requestId, providerId]);

    // Subscription Realtime na tabela canônica chat_messages e requests
    useEffect(() => {
        if (!providerId || !requestId) return;

        const chatChannel = supabase
            .channel(`provider_chat_thread_messages_${requestId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `request_id=eq.${requestId}`,
                },
                (payload) => {
                    queryClient.invalidateQueries({ queryKey: ['provider_chat_thread', providerId, requestId] });
                    queryClient.invalidateQueries({ queryKey: ['provider_chat_inbox', providerId] });

                    // Se a tela estiver focada e a mensagem recebida for do interlocutor, marca como lida
                    if (isFocused && payload.eventType === 'INSERT' && payload.new?.sender_id !== providerId) {
                        markProviderChatThreadAsRead(requestId).catch(() => {});
                    }
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
            supabase.removeChannel(chatChannel);
            supabase.removeChannel(requestChannel);
        };
    }, [providerId, queryClient, requestId, isFocused]);

    return {
        thread: query.data?.thread || null,
        messages: query.data?.messages || [],
        loading: query.isLoading,
        error: query.error ? toErrorMessage(query.error, 'Erro ao carregar conversa.') : null,
        sending: sendMutation.isPending,
        sendMessage: async (text: string) => {
            if (!requestId) throw new Error('Identificador de pedido não encontrado.');
            const clientMessageId = Crypto.randomUUID();
            return sendMutation.mutateAsync({
                requestId,
                text,
                clientMessageId,
            });
        },
        refetch: query.refetch,
    };
}
