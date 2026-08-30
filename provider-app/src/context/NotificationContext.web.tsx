import { InAppBannerData, InAppNotificationBanner } from '@/components/InAppNotificationBanner';
import { supabase } from '@/services/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

export interface NotificationContextType {
    expoPushToken: string | null;
    notification: any | null;
    badgeCount: number;
    resetBadge: () => Promise<void>;
    inAppBanner: InAppBannerData | null;
    dismissBanner: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
    expoPushToken: null,
    notification: null,
    badgeCount: 0,
    resetBadge: async () => { },
    inAppBanner: null,
    dismissBanner: () => { },
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const params = useGlobalSearchParams<{ id?: string; requestId?: string }>();
    const queryClient = useQueryClient();
    const [expoPushToken] = useState<string | null>(null);
    const [notification] = useState<any | null>(null);
    const [badgeCount, setBadgeCount] = useState(0);
    const [inAppBanner, setInAppBanner] = useState<InAppBannerData | null>(null);
    const seenNotificationIdsRef = useRef<Set<string>>(new Set());
    const seenMessageIdsRef = useRef<Set<string>>(new Set());

    // Keep active route reference to suppress banner when inside the active chat thread
    const currentRouteRef = useRef({ pathname, activeRequestId: params.id || params.requestId });
    useEffect(() => {
        currentRouteRef.current = { pathname, activeRequestId: params.id || params.requestId };
    }, [pathname, params.id, params.requestId]);

    // Web: Listen to canonical chat_messages for Realtime in-app banner with real message preview
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`provider_chat_messages_banner_web_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_messages',
                },
                (payload: any) => {
                    // Always invalidate provider inbox query on any message change
                    queryClient.invalidateQueries({ queryKey: ['provider_chat_inbox', user.id] });

                    if (payload.eventType !== 'INSERT') return;

                    const record = payload.new;
                    if (!record || !record.id) return;

                    // Ignore messages sent by the provider themselves
                    if (record.sender_id === user.id) return;

                    // Deduplicate by message ID
                    if (seenMessageIdsRef.current.has(record.id)) return;
                    seenMessageIdsRef.current.add(record.id);

                    const { pathname: currentPath, activeRequestId } = currentRouteRef.current;
                    const isChatActiveForSameRequest =
                        record.request_id &&
                        (currentPath?.includes('/chat') && (activeRequestId === record.request_id || currentPath.includes(record.request_id)));

                    // Suppress banner if provider is actively in this chat thread
                    if (isChatActiveForSameRequest) {
                        return;
                    }

                    const bodyText = record.body || '';
                    const previewText = bodyText.length > 90 ? bodyText.slice(0, 87) + '...' : bodyText;

                    setInAppBanner({
                        id: record.id,
                        title: 'Nova mensagem no atendimento',
                        message: previewText || 'Você recebeu uma nova mensagem.',
                        type: 'message',
                        relatedId: record.request_id,
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, queryClient]);

    // Web: Listen for Supabase notifications table directly for non-message in-app alerts
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`provider_notifications_web_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload: any) => {
                    const record = payload.new;
                    if (!record || !record.id) return;

                    // Invalidate inbox query to keep sync
                    queryClient.invalidateQueries({ queryKey: ['provider_chat_inbox', user.id] });

                    // Skip type='message' notifications since chat_messages listener handles it with real preview
                    if (record.type === 'message') {
                        return;
                    }

                    // Deduplicate by notification ID
                    if (seenNotificationIdsRef.current.has(record.id)) return;
                    seenNotificationIdsRef.current.add(record.id);

                    const bannerTitle = record.title || 'Notificação';
                    const bannerMessage = record.message || 'Você recebeu uma atualização.';

                    setInAppBanner({
                        id: record.id,
                        title: bannerTitle,
                        message: bannerMessage,
                        type: record.type,
                        relatedId: record.related_id,
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, queryClient]);

    const resetBadge = async () => {
        setBadgeCount(0);
    };

    const dismissBanner = () => {
        setInAppBanner(null);
    };

    const handleBannerPress = (banner: InAppBannerData) => {
        dismissBanner();
        if (banner.type === 'message' && banner.relatedId) {
            router.push(`/chat/${banner.relatedId}` as any);
        } else if (banner.type === 'job_request' && banner.relatedId) {
            router.push({ pathname: '/jobDetail', params: { requestId: banner.relatedId } } as any);
        } else if (banner.relatedId) {
            router.push(`/chat/${banner.relatedId}` as any);
        }
    };

    return (
        <NotificationContext.Provider
            value={{
                expoPushToken,
                notification,
                badgeCount,
                resetBadge,
                inAppBanner,
                dismissBanner,
            }}
        >
            {children}
            <InAppNotificationBanner
                banner={inAppBanner}
                onDismiss={dismissBanner}
                onPress={handleBannerPress}
            />
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => useContext(NotificationContext);
