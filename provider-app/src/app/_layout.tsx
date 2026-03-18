import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

const queryClient = new QueryClient();

export default function RootLayout() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <NotificationProvider>
                    <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="(auth)" />
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="auth/callback" />
                        <Stack.Screen name="profile/edit" />
                        <Stack.Screen name="chat/[id]" />
                        <Stack.Screen name="jobDetail" />
                    </Stack>
                    <StatusBar style="dark" />
                </NotificationProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}
