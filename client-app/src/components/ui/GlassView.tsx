import React from 'react';
import { StyleSheet, View, ViewStyle, Platform, StyleProp } from 'react-native';
import { BlurView, BlurTint } from 'expo-blur';
import { Layout, Colors } from '@/constants/Colors';

interface GlassViewProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    intensity?: number;
    tint?: BlurTint; // Use the full BlurTint type from expo-blur
    rounded?: boolean;
}

export function GlassView({
    children,
    style,
    intensity = 20,
    tint = 'light',
    rounded = true
}: GlassViewProps) {

    // iOS supports native blur
    if (Platform.OS === 'ios') {
        return (
            <BlurView
                intensity={intensity}
                tint={tint}
                style={[
                    styles.container,
                    rounded && styles.rounded,
                    style
                ]}
            >
                {children}
            </BlurView>
        );
    }

    // Android fallback (translucent background)
    // Note: expo-blur supports experimental blur on Android but often requires enabling. 
    // For MVP stability we use a translucent fill.
    return (
        <View
            style={[
                styles.container,
                rounded && styles.rounded,
                { backgroundColor: tint === 'dark' ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.9)' },
                styles.androidBorder,
                style
            ]}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
    rounded: {
        borderRadius: Layout.radius.lg,
    },
    androidBorder: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
    }
});
