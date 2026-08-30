import { useAuth } from '@/context/AuthContext';
import { fetchChatInbox } from '@/services/chatService';
import { supabase } from '@/services/supabase';
import { useIsFocused } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

export function useChatInbox() {
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const channelIdRef = useRef(Math.random().toString(36).substring(2, 9));
  const queryKey = ['chat_inbox', user?.id];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchChatInbox(user!.id),
    enabled: !!user,
    staleTime: 10 * 1000,
  });

  // Refetch garantido ao focar na tela de inbox
  useEffect(() => {
    if (isFocused && user) {
      query.refetch();
    }
  }, [isFocused, user]);

  useEffect(() => {
    if (!user) return;

    // Escuta novas mensagens na tabela canônica chat_messages
    const chatChannel = supabase
      .channel(`chat_inbox_messages_${user.id}_${channelIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    const requestsChannel = supabase
      .channel(`chat_inbox_requests_${user.id}_${channelIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(requestsChannel);
    };
  }, [user?.id, queryClient]);

  return {
    threads: query.data || [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : query.error ? String(query.error) : null,
    refetch: query.refetch,
  };
}
