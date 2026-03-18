import { useAuth } from '@/context/AuthContext';
import { Redirect, Stack } from 'expo-router';

export default function AuthLayout() {
    const { session } = useAuth();

    // If already logged in, redirect to main app
    if (session) {
        return <Redirect href="/(tabs)/jobs" />;
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="verify" />
        </Stack>
    );
}
