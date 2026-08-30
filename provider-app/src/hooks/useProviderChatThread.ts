import { useAuth } from '@/context/AuthContext';
import { useAppVisibility } from '@/hooks/useAppVisibility';
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
import { useCallback, useEffect, useMemo, useRef } from 'react';

interface SendMessageVariables {
    requestId: string;
    text: string;
    clientMessageId: string;
}

export function useProviderChatThread(requestId?: string) {
    const { user } = useAuth();
    const providerId = user?.id;
    const isFocused = useIsFocused();
    const isAppVisible = useAppVisibility();
    const queryClient = useQueryClient();
    const isMarkingReadRef = useRef(false);
    const channelIdRef = useRef(Math.random().toString(36).substring(2, 9));
    const threadQueryKey = useMemo(() => ['provider_chat_thread', providerId, requestId], [providerId, requestId]);

    const isThreadVisiblyActive = isFocused && isAppVisible;
    const isThreadVisiblyActiveRef = useRef(isThreadVisiblyActive);
    useEffect(() => {
        isThreadVisiblyActiveRef.current = isThreadVisiblyActive;
    }, [isThreadVisiblyActive]);

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
            queryClient.invalidateQueries({ queryKey: threadQueryKey });
            queryClient.invalidateQueries({ queryKey: ['provider_chat_inbox', providerId] });
        },
    });

    // Função segura e coalescida para marcar mensagens da thread como lidas
    const triggerMarkRead = useCallback(async () => {
        if (!providerId || !requestId || !isThreadVisiblyActiveRef.current || isMarkingReadRef.current) return;

        isMarkingReadRef.current = true;
        try {
            const updatedCount = await markProviderChatThreadAsRead(requestId);
            if (updatedCount > 0) {
                queryClient.invalidateQueries({ queryKey: threadQueryKey });
                queryClient.invalidateQueries({ queryKey: ['provider_chat_inbox', providerId] });
            }
        } catch {
            // Falha silenciosa não deve quebrar a experiência
        } finally {
            isMarkingReadRef.current = false;
        }
    }, [providerId, requestId, queryClient, threadQueryKey]);

    // Marcação de leitura acionada quando a thread está visivelmente ativa e há mensagens não lidas
    useEffect(() => {
        if (!isThreadVisiblyActive || !providerId || !requestId) return;

        const hasUnreadIncoming = query.data?.messages?.some(
            (m) => m.direction === 'incoming' && !m.readAt
        );

        if (hasUnreadIncoming) {
            triggerMarkRead();
        }
    }, [isThreadVisiblyActive, providerId, requestId, query.data?.messages, triggerMarkRead]);

    // Refetch garantido ao transicionar para visivelmente ativo
    useEffect(() => {
        if (isThreadVisiblyActive && requestId && providerId) {
            query.refetch();
        }
    }, [isThreadVisiblyActive, requestId, providerId]);

    // Subscription Realtime na tabela canônica chat_messages e requests
    useEffect(() => {
        if (!providerId || !requestId) return;

        const chatChannel = supabase
            .channel(`provider_chat_thread_messages_${requestId}_${channelIdRef.current}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `request_id=eq.${requestId}`,
                },
                (payload) => {
                    queryClient.invalidateQueries({ queryKey: threadQueryKey });
                    queryClient.invalidateQueries({ queryKey: ['provider_chat_inbox', providerId] });

                    // Se a thread estiver visivelmente ativa e o interlocutor enviou mensagem nova, marca leitura
                    if (
                        payload.eventType === 'INSERT' &&
                        payload.new?.sender_id !== providerId &&
                        isThreadVisiblyActiveRef.current
                    ) {
                        triggerMarkRead();
                    }
                }
            )
            .subscribe();

        const requestChannel = supabase
            .channel(`provider_chat_thread_request_${requestId}_${channelIdRef.current}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'requests',
                    filter: `id=eq.${requestId}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: threadQueryKey });
                    queryClient.invalidateQueries({ queryKey: ['provider_chat_inbox', providerId] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(chatChannel);
            supabase.removeChannel(requestChannel);
        };
    }, [providerId, queryClient, requestId, threadQueryKey, triggerMarkRead]);

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
