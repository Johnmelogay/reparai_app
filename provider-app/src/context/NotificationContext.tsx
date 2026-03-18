import { supabase } from '@/services/supabase';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './AuthContext';

// Configure how notifications are handled when the app is foregrounded
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

interface NotificationContextType {
    expoPushToken: string | null;
    notification: Notifications.Notification | null;
    badgeCount: number;
    resetBadge: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
    expoPushToken: null,
    notification: null,
    badgeCount: 0,
    resetBadge: async () => { },
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const router = useRouter();
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notification, setNotification] = useState<Notifications.Notification | null>(null);
    const [badgeCount, setBadgeCount] = useState(0);
    const notificationListener = useRef<any>(null);
    const responseListener = useRef<any>(null);

    useEffect(() => {
        registerForPushNotificationsAsync().then(token => setExpoPushToken(token ?? null));

        // This listener is fired whenever a notification is received while the app is foregrounded
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            setNotification(notification);
            setBadgeCount(prev => prev + 1);
        });

        // This listener is fired whenever a user taps on or interacts with a notification
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;
            if (data?.requestId) {
                if (data.type === 'message') {
                    // @ts-ignore
                    router.push(`/chat/${data.requestId}`);
                } else if (data.type === 'job_request') {
                    // @ts-ignore
                    router.push({ pathname: '/jobDetail', params: { requestId: data.requestId } });
                } else {
                    // @ts-ignore
                    router.push(`/ticket/${data.requestId}`);
                }
            }
        });

        return () => {
            notificationListener.current?.remove();
            responseListener.current?.remove();
        };
    }, []);

    // Also listen for Supabase notifications table directly (Realtime fallback/primary for chat)
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`provider_notifications_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                async (payload) => {
                    console.log('🔔 Provider: New notification record:', payload.new);
                    
                    // If app is in foreground, trigger a local notification to ensure sound/alert
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title: payload.new.title?.includes(':') ? 'Nova mensagem' : payload.new.title,
                            body: payload.new.message,
                            data: { 
                                requestId: payload.new.related_id,
                                type: payload.new.type
                            },
                        },
                        trigger: null, // show immediately
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const resetBadge = async () => {
        await Notifications.setBadgeCountAsync(0);
        setBadgeCount(0);
    };

    return (
        <NotificationContext.Provider value={{ expoPushToken, notification, badgeCount, resetBadge }}>
            {children}
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => useContext(NotificationContext);

async function registerForPushNotificationsAsync() {
    let token;
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
        return;
    }
    
    try {
        token = (await Notifications.getExpoPushTokenAsync()).data;
    } catch (e) {
        // Might fail in simulator
    }

    return token;
}
