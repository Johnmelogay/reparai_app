import { useAuth } from '@/context/AuthContext';
import { fetchChatThread, markChatThreadAsRead, sendChatMessage } from '@/services/chatService';
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

export function useChatThread(requestId?: string) {
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const isMarkingReadRef = useRef(false);
  const queryKey = ['chat_thread', user?.id, requestId];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchChatThread(user!.id, requestId!),
    enabled: !!user && !!requestId,
    staleTime: 10 * 1000,
  });

  const sendMutation = useMutation({
    mutationFn: async ({ requestId: reqId, text, clientMessageId }: SendMessageVariables) => {
      if (!user || !reqId) {
        throw new Error('Sessão inválida para envio de mensagem.');
      }
      return sendChatMessage(reqId, text, clientMessageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['chat_inbox', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  // Marcação de leitura acionada quando a tela está em foco e há mensagens não lidas
  useEffect(() => {
    if (!user || !requestId || !isFocused || isMarkingReadRef.current) return;

    const hasUnreadIncoming = query.data?.messages?.some(
      (m) => m.direction === 'incoming' && !m.readAt
    );

    if (hasUnreadIncoming) {
      isMarkingReadRef.current = true;
      markChatThreadAsRead(requestId)
        .then((updatedCount) => {
          if (updatedCount > 0) {
            queryClient.invalidateQueries({ queryKey });
            queryClient.invalidateQueries({ queryKey: ['chat_inbox', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
          }
        })
        .catch(() => {
          // Falhas silenciosas de mark-read não devem travar a experiência do usuário
        })
        .finally(() => {
          isMarkingReadRef.current = false;
        });
    }
  }, [user?.id, requestId, isFocused, query.data?.messages, queryClient]);

  // Refetch garantido ao recuperar foco na tela
  useEffect(() => {
    if (isFocused && requestId && user) {
      query.refetch();
    }
  }, [isFocused, requestId, user]);

  // Subscription Realtime na tabela canônica chat_messages e requests
  useEffect(() => {
    if (!user || !requestId) return;

    const chatChannel = supabase
      .channel(`chat_thread_messages_${requestId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `request_id=eq.${requestId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey });
          queryClient.invalidateQueries({ queryKey: ['chat_inbox', user?.id] });
          queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });

          // Se a tela estiver focada e a mensagem recebida for do interlocutor, marca como lida
          if (isFocused && payload.eventType === 'INSERT' && payload.new?.sender_id !== user.id) {
            markChatThreadAsRead(requestId).catch(() => {});
          }
        }
      )
      .subscribe();

    const requestChannel = supabase
      .channel(`chat_thread_request_${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'requests',
          filter: `id=eq.${requestId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
          queryClient.invalidateQueries({ queryKey: ['chat_inbox', user?.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(requestChannel);
    };
  }, [user?.id, requestId, isFocused, queryClient]);

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
