import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/context/AuthContext';
import { LocationProvider } from '@/context/LocationContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { RequestProvider } from '@/context/RequestContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

// Create a client
const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NotificationProvider>
            <LocationProvider>
            <RequestProvider>
              <Stack screenOptions={{ headerShown: false }}>
                {/* ... screens */}
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="request/new/index" />
                <Stack.Screen name="provider/[id]" options={{ presentation: 'modal' }} />
                <Stack.Screen name="ticket/[id]" options={{ presentation: 'modal' }} />
                <Stack.Screen name="chat" options={{ presentation: 'modal' }} />
              </Stack>
              <StatusBar style="dark" />
            </RequestProvider>
          </LocationProvider>
        </NotificationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
