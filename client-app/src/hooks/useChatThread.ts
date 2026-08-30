import { useAuth } from '@/context/AuthContext';
import { useAppVisibility } from '@/hooks/useAppVisibility';
import { fetchChatThread, markChatThreadAsRead, sendChatMessage } from '@/services/chatService';
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

export function useChatThread(requestId?: string) {
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const isAppVisible = useAppVisibility();
  const queryClient = useQueryClient();
  const isMarkingReadRef = useRef(false);
  const pendingMarkReadRef = useRef(false);
  const isMountedRef = useRef(true);
  const channelIdRef = useRef(Math.random().toString(36).substring(2, 9));
  const queryKey = useMemo(() => ['chat_thread', user?.id, requestId], [user?.id, requestId]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const isThreadVisiblyActive = isFocused && isAppVisible;
  const isThreadVisiblyActiveRef = useRef(isThreadVisiblyActive);
  useEffect(() => {
    isThreadVisiblyActiveRef.current = isThreadVisiblyActive;
  }, [isThreadVisiblyActive]);

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

  // Função serial e coalescida para marcar mensagens da thread como lidas
  const triggerMarkRead = useCallback(async () => {
    if (!user || !requestId || !isThreadVisiblyActiveRef.current || !isMountedRef.current) {
      return;
    }

    pendingMarkReadRef.current = true;

    if (isMarkingReadRef.current) {
      // Já existe uma RPC em execução; ela consumirá pendingMarkReadRef ao concluir
      return;
    }

    isMarkingReadRef.current = true;

    try {
      while (
        pendingMarkReadRef.current &&
        isThreadVisiblyActiveRef.current &&
        isMountedRef.current
      ) {
        pendingMarkReadRef.current = false;

        try {
          const updatedCount = await markChatThreadAsRead(requestId);
          if (updatedCount > 0 && isMountedRef.current) {
            queryClient.invalidateQueries({ queryKey });
            queryClient.invalidateQueries({ queryKey: ['chat_inbox', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
          }
        } catch {
          console.warn('Falha temporária ao marcar mensagens como lidas', { requestId });
          pendingMarkReadRef.current = false;
          break;
        }
      }
    } finally {
      isMarkingReadRef.current = false;

      if (
        pendingMarkReadRef.current &&
        isMountedRef.current &&
        isThreadVisiblyActiveRef.current
      ) {
        void triggerMarkRead();
      }
    }
  }, [user, requestId, queryClient, queryKey]);

  // Marcação de leitura ao focar/tornar visível a thread com mensagens não lidas
  useEffect(() => {
    if (!isThreadVisiblyActive || !requestId || !user) return;

    const hasUnreadIncoming = query.data?.messages?.some(
      (m) => m.direction === 'incoming' && !m.readAt
    );

    if (hasUnreadIncoming) {
      triggerMarkRead();
    }
  }, [isThreadVisiblyActive, requestId, user, query.data?.messages, triggerMarkRead]);

  // Refetch garantido ao transicionar para visivelmente ativo
  useEffect(() => {
    if (isThreadVisiblyActive && requestId && user) {
      query.refetch();
    }
  }, [isThreadVisiblyActive, requestId, user]);

  // Subscription Realtime na tabela canônica chat_messages e requests
  useEffect(() => {
    if (!user || !requestId) return;

    const chatChannel = supabase
      .channel(`chat_thread_messages_${requestId}_${channelIdRef.current}`)
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

          // Se a thread estiver visivelmente ativa e o interlocutor enviou mensagem nova, marca leitura
          if (
            payload.eventType === 'INSERT' &&
            payload.new?.sender_id !== user.id &&
            isThreadVisiblyActiveRef.current
          ) {
            triggerMarkRead();
          }
        }
      )
      .subscribe();

    const requestChannel = supabase
      .channel(`chat_thread_request_${requestId}_${channelIdRef.current}`)
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
  }, [user?.id, requestId, queryClient, queryKey, triggerMarkRead]);

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
