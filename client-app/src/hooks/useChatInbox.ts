import { useAuth } from '@/context/AuthContext';
import { fetchChatInbox } from '@/services/chatService';
import { supabase } from '@/services/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export function useChatInbox() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['chat_inbox', user?.id];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchChatInbox(user!.id),
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (!user) return;

    const notificationsChannel = supabase
      .channel(`chat_inbox_notifications_${user.id}`)
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
        }
      )
      .subscribe();

    const requestsChannel = supabase
      .channel(`chat_inbox_requests_${user.id}`)
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
      supabase.removeChannel(notificationsChannel);
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
