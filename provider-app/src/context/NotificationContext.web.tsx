import { InAppBannerData, InAppNotificationBanner } from '@/components/InAppNotificationBanner';
import { supabase } from '@/services/supabase';
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
    const [expoPushToken] = useState<string | null>(null);
    const [notification] = useState<any | null>(null);
    const [badgeCount, setBadgeCount] = useState(0);
    const [inAppBanner, setInAppBanner] = useState<InAppBannerData | null>(null);
    const seenNotificationIdsRef = useRef<Set<string>>(new Set());

    // Keep active route reference to suppress banner when inside the active chat thread
    const currentRouteRef = useRef({ pathname, activeRequestId: params.id || params.requestId });
    useEffect(() => {
        currentRouteRef.current = { pathname, activeRequestId: params.id || params.requestId };
    }, [pathname, params.id, params.requestId]);

    // Web: Listen for Supabase notifications table directly via Realtime
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

                    setBadgeCount(prev => prev + 1);

                    // Deduplicate by notification ID
                    if (seenNotificationIdsRef.current.has(record.id)) return;
                    seenNotificationIdsRef.current.add(record.id);

                    const { pathname: currentPath, activeRequestId } = currentRouteRef.current;
                    const isChatActiveForSameRequest =
                        record.type === 'message' &&
                        record.related_id &&
                        (currentPath?.includes('/chat') && (activeRequestId === record.related_id || currentPath.includes(record.related_id)));

                    // Do not show banner if provider is currently inside this chat thread
                    if (isChatActiveForSameRequest) {
                        return;
                    }

                    const bannerTitle = record.title?.includes(':') ? 'Nova mensagem' : (record.title || 'Notificação');
                    const bannerMessage = record.message || 'Você recebeu uma atualização no atendimento.';

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
    }, [user]);

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
