import { Colors } from '@/constants/Colors';
import { useProviderChatInbox } from '@/hooks/useProviderChatInbox';
import { Tabs } from 'expo-router';
import { Briefcase, ClipboardList, MessageCircle, User } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';

export default function TabLayout() {
    const { threads } = useProviderChatInbox();
    const unreadConversationsCount = threads.filter((item) => item.unreadCount > 0).length;
    const chatBadge = unreadConversationsCount > 0 ? (unreadConversationsCount > 99 ? '99+' : String(unreadConversationsCount)) : undefined;

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: Colors.light.primary,
                tabBarInactiveTintColor: Colors.light.tabIconDefault,
                tabBarStyle: {
                    backgroundColor: '#fff',
                    borderTopWidth: 1,
                    borderTopColor: '#f0f0f0',
                    paddingTop: 5,
                    height: Platform.OS === 'ios' ? 85 : 60,
                },
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '500',
                    marginBottom: 5,
                },
            }}
        >
            <Tabs.Screen
                name="jobs"
                options={{
                    title: 'Pedidos',
                    tabBarIcon: ({ color }) => <ClipboardList size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="active"
                options={{
                    title: 'Serviços',
                    tabBarIcon: ({ color }) => <Briefcase size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="chat"
                options={{
                    title: 'Chat',
                    tabBarIcon: ({ color }) => <MessageCircle size={24} color={color} />,
                    tabBarBadge: chatBadge,
                    tabBarBadgeStyle: { backgroundColor: Colors.light.primary, fontSize: 10 },
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Perfil',
                    tabBarIcon: ({ color }) => <User size={24} color={color} />,
                }}
            />
        </Tabs>
    );
}
