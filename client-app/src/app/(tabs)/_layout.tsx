import { Colors } from '@/constants/Colors';
import { useChatInbox } from '@/hooks/useChatInbox';
import { useNotifications } from '@/hooks/useNotifications';
import { Tabs } from 'expo-router';
import { Bell, House, List, Search, User } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';

export default function TabLayout() {
  const { unreadNonMessageCount } = useNotifications();
  const { threads: chatThreads } = useChatInbox();

  const conversasComMensagensNaoLidas = chatThreads.filter((t) => t.unreadCount > 0).length;
  const totalBadgeCount = conversasComMensagensNaoLidas + unreadNonMessageCount;

  const notificationsBadge = totalBadgeCount > 0
    ? totalBadgeCount > 99 ? '99+' : String(totalBadgeCount)
    : undefined;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.light.primary,
        tabBarInactiveTintColor: '#999',
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
        name="home"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color }) => <House size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ color }) => <List size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Buscar',
          tabBarIcon: ({ color }) => <Search size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notificações',
          tabBarIcon: ({ color }) => <Bell size={24} color={color} />,
          tabBarBadge: notificationsBadge,
          tabBarBadgeStyle: { backgroundColor: '#EF4444', fontSize: 10 },
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
