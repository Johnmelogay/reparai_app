import { useAuth } from '@/context/AuthContext';
import { fetchChatThread, markChatThreadAsRead, sendChatMessage } from '@/services/chatService';
import { supabase } from '@/services/supabase';
import { toErrorMessage } from '@/utils/error';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export function useChatThread(requestId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['chat_thread', user?.id, requestId];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchChatThread(user!.id, requestId!),
    enabled: !!user && !!requestId,
    staleTime: 10 * 1000,
    refetchInterval: 6 * 1000,
  });

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!user || !requestId) {
        throw new Error('Sessão inválida para envio de mensagem.');
      }
      await sendChatMessage(user.id, requestId, text);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['chat_inbox', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  useEffect(() => {
    if (!user || !requestId || !query.data?.messages?.length) return;

    markChatThreadAsRead(user.id, requestId)
      .then(() => {
        queryClient.invalidateQueries({ queryKey });
        queryClient.invalidateQueries({ queryKey: ['chat_inbox', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      })
      .catch(() => {
        // no-op: read sync failure should not break chat usage
      });
  }, [user?.id, requestId, query.data?.messages?.length, queryClient]);

  useEffect(() => {
    if (!user || !requestId) return;

    const notificationsChannel = supabase
      .channel(`chat_thread_notifications_${requestId}_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
          queryClient.invalidateQueries({ queryKey: ['chat_inbox', user?.id] });
          queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
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
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(requestChannel);
    };
  }, [user?.id, requestId, queryClient]);

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
