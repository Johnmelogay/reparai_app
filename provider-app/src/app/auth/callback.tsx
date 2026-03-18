import { Colors } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/**
 * AuthCallback Screen
 * 
 * This screen handles the deep link redirect from Supabase (Magic Link or OAuth).
 * It shows a loading state while the AuthContext listens for the session change.
 */
export default function AuthCallback() {
    const router = useRouter();

    useEffect(() => {
        // We wait a brief moment for the Supabase session to be established 
        // via the onAuthStateChange listener in AuthContext.
        // Then we redirect the user to the initial screen which handles 
        // the session-based navigation logic.
        const timeout = setTimeout(() => {
            router.replace('/');
        }, 1500);

        return () => clearTimeout(timeout);
    }, []);

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
