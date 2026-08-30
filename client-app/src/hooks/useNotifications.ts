import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import { Notification } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

export function useNotifications() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const channelIdRef = useRef(Math.random().toString(36).substring(2, 9));

    const queryKey = ['notifications', user?.id];

    const {
        data: notifications = [],
        isLoading: loading,
        error,
        refetch: fetchNotifications
    } = useQuery({
        queryKey,
        queryFn: async () => {
            if (!user) return [];

            const { data, error: fetchError } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;
            return (data || []) as Notification[];
        },
        enabled: !!user,
        staleTime: 10 * 1000,
    });

    const markAsReadMutation = useMutation({
        mutationFn: async (notificationId: string) => {
            if (!user) throw new Error('No user');
            const { error: updateError } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notificationId)
                .eq('user_id', user.id);
            if (updateError) throw updateError;
            return notificationId;
        },
        onMutate: async (notificationId: string) => {
            await queryClient.cancelQueries({ queryKey });
            const previous = queryClient.getQueryData<Notification[]>(queryKey);
            if (previous) {
                queryClient.setQueryData<Notification[]>(queryKey, (old) =>
                    old?.map((n: Notification) => n.id === notificationId ? { ...n, is_read: true } : n) || []
                );
            }
            return { previous };
        },
        onError: (_err: Error, _id: string, context: any) => {
            if (context?.previous) {
                queryClient.setQueryData(queryKey, context.previous);
            }
        },
    });

    const markAllAsReadMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error('No user');
            const { error: updateError } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('is_read', false);
            if (updateError) throw updateError;
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey });
            const previous = queryClient.getQueryData<Notification[]>(queryKey);
            if (previous) {
                queryClient.setQueryData<Notification[]>(queryKey, (old) =>
                    old?.map((n: Notification) => ({ ...n, is_read: true })) || []
                );
            }
            return { previous };
        },
        onError: (_err: Error, _vars: void, context: any) => {
            if (context?.previous) {
                queryClient.setQueryData(queryKey, context.previous);
            }
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (notificationId: string) => {
            if (!user) throw new Error('No user');
            const { error: deleteError } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId)
                .eq('user_id', user.id);
            if (deleteError) throw deleteError;
            return notificationId;
        },
        onMutate: async (notificationId: string) => {
            await queryClient.cancelQueries({ queryKey });
            const previous = queryClient.getQueryData<Notification[]>(queryKey);
            if (previous) {
                queryClient.setQueryData<Notification[]>(queryKey, (old) =>
                    old?.filter((n: Notification) => n.id !== notificationId) || []
                );
            }
            return { previous };
        },
        onError: (_err: Error, _id: string, context: any) => {
            if (context?.previous) {
                queryClient.setQueryData(queryKey, context.previous);
            }
        },
    });

    // Subscribe to real-time updates directly into React Query cache
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`user_notifications_${user.id}_${channelIdRef.current}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload: any) => {
                    queryClient.setQueryData<Notification[]>(queryKey, (prev = []) => {
                        if (payload.eventType === 'INSERT') {
                            // Deduplicate by ID
                            if (prev.some((n) => n.id === payload.new.id)) return prev;
                            return [payload.new as Notification, ...prev];
                        } else if (payload.eventType === 'UPDATE') {
                            return prev.map((n: Notification) => n.id === payload.new.id ? payload.new as Notification : n);
                        } else if (payload.eventType === 'DELETE') {
                            return prev.filter((n: Notification) => n.id !== payload.old.id);
                        }
                        return prev;
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, queryClient]);

    const nonMessageNotifications = useMemo(
        () => notifications.filter((n: Notification) => n.type !== 'message'),
        [notifications]
    );

    const unreadNonMessageCount = useMemo(
        () => nonMessageNotifications.filter((n: Notification) => !n.is_read).length,
        [nonMessageNotifications]
    );

    const unreadCount = useMemo(
        () => notifications.filter((n: Notification) => !n.is_read).length,
        [notifications]
    );

    return {
        notifications,
        nonMessageNotifications,
        loading,
        error: error ? (error instanceof Error ? error.message : String(error)) : null,
        unreadCount,
        unreadNonMessageCount,
        fetchNotifications,
        markAsRead: (id: string) => markAsReadMutation.mutateAsync(id).catch(console.error),
        markAllAsRead: () => markAllAsReadMutation.mutateAsync().catch(console.error),
        deleteNotification: (id: string) => deleteMutation.mutateAsync(id).catch(console.error),
    };
}
