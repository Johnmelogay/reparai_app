import { supabase } from '@/services/supabase';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

export interface NotificationContextType {
    expoPushToken: string | null;
    notification: any | null;
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
    const [expoPushToken] = useState<string | null>(null);
    const [notification] = useState<any | null>(null);
    const [badgeCount, setBadgeCount] = useState(0);

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
                    console.log('🔔 Provider (Web): New notification record:', payload.new);
                    setBadgeCount(prev => prev + 1);
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

    return (
        <NotificationContext.Provider value={{ expoPushToken, notification, badgeCount, resetBadge }}>
            {children}
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => useContext(NotificationContext);
