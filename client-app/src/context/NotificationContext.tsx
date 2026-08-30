import { InAppBannerData, InAppNotificationBanner } from '@/components/InAppNotificationBanner';
import { supabase } from '@/services/supabase';
import * as Notifications from 'expo-notifications';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './AuthContext';

// Check if native notification modules are available (they aren't in Expo Go)
let notificationsAvailable = true;
try {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
} catch (e) {
    notificationsAvailable = false;
}

interface NotificationContextType {
    expoPushToken: string | null;
    notification: Notifications.Notification | null;
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
    const params = useGlobalSearchParams<{ id?: string }>();
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notification, setNotification] = useState<Notifications.Notification | null>(null);
    const [badgeCount, setBadgeCount] = useState(0);
    const [inAppBanner, setInAppBanner] = useState<InAppBannerData | null>(null);
    const seenNotificationIdsRef = useRef<Set<string>>(new Set());
    const notificationListener = useRef<any>(null);
    const responseListener = useRef<any>(null);

    // Keep active route reference to suppress banner when inside the active chat thread
    const currentRouteRef = useRef({ pathname, activeRequestId: params.id });
    useEffect(() => {
        currentRouteRef.current = { pathname, activeRequestId: params.id };
    }, [pathname, params.id]);

    useEffect(() => {
        if (!notificationsAvailable) return;

        registerForPushNotificationsAsync().then(token => setExpoPushToken(token ?? null));

        try {
            notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
                setNotification(notification);
                setBadgeCount(prev => prev + 1);
            });

            responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
                const data = response.notification.request.content.data;
                if (data?.requestId) {
                    if (data.type === 'message') {
                        router.push(`/chat/${data.requestId}` as any);
                    } else {
                        router.push(`/ticket/${data.requestId}` as any);
                    }
                }
            });
        } catch (e) {
            console.warn('⚠️ Failed to register notification listeners:', e);
        }

        return () => {
            notificationListener.current?.remove();
            responseListener.current?.remove();
        };
    }, [router]);

    // Listen for Supabase notifications table directly (Realtime in-app foreground banner)
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`user_inapp_notifications_${user.id}`)
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

                    // Deduplicate by notification ID
                    if (seenNotificationIdsRef.current.has(record.id)) return;
                    seenNotificationIdsRef.current.add(record.id);

                    const { pathname: currentPath, activeRequestId } = currentRouteRef.current;
                    const isChatActiveForSameRequest =
                        record.type === 'message' &&
                        record.related_id &&
                        (currentPath?.includes('/chat') && (activeRequestId === record.related_id || currentPath.includes(record.related_id)));

                    // Do not show banner if user is currently inside this chat thread
                    if (isChatActiveForSameRequest) {
                        return;
                    }

                    const bannerTitle = record.title?.includes(':') ? 'Nova mensagem' : (record.title || 'Notificação');
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
    }, [user]);

    const resetBadge = async () => {
        try {
            if (notificationsAvailable) {
                await Notifications.setBadgeCountAsync(0);
            }
        } catch (e) {
            // ignore
        }
        setBadgeCount(0);
    };

    const dismissBanner = () => {
        setInAppBanner(null);
    };

    const handleBannerPress = (banner: InAppBannerData) => {
        dismissBanner();
        if (banner.type === 'message' && banner.relatedId) {
            router.push(`/chat/${banner.relatedId}` as any);
        } else if (banner.relatedId) {
            router.push(`/ticket/${banner.relatedId}` as any);
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

async function registerForPushNotificationsAsync() {
    if (!notificationsAvailable) return null;

    let token;
    try {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            return null;
        }

        token = (await Notifications.getExpoPushTokenAsync()).data;
    } catch (e) {
        console.warn('⚠️ Failed to register for push notifications:', e);
        return null;
    }

    return token;
}
