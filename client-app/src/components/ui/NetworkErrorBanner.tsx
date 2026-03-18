/**
 * NetworkErrorBanner — Reusable banner for data fetching failures.
 *
 * Usage:
 *   <NetworkErrorBanner
 *     visible={!!error}
 *     message="Não foi possível carregar prestadores"
 *     onRetry={() => refetch()}
 *   />
 */
import { Colors } from '@/constants/Colors';
import { RefreshCw, WifiOff } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface NetworkErrorBannerProps {
    visible: boolean;
    message?: string;
    onRetry?: () => void;
    style?: object;
}

export function NetworkErrorBanner({
    visible,
    message = 'Erro ao carregar dados. Verifique sua conexão.',
    onRetry,
    style,
}: NetworkErrorBannerProps) {
    if (!visible) return null;

    return (
        <View style={[styles.container, style]}>
            <View style={styles.content}>
                <WifiOff size={18} color="#DC2626" strokeWidth={2.5} />
                <Text style={styles.message} numberOfLines={2}>
                    {message}
                </Text>
            </View>
            {onRetry && (
                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={onRetry}
                    activeOpacity={0.7}
                >
                    <RefreshCw size={14} color={Colors.light.primary} strokeWidth={2.5} />
                    <Text style={styles.retryText}>Tentar</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginHorizontal: 16,
        marginVertical: 8,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    message: {
        fontSize: 13,
        color: '#991B1B',
        fontWeight: '500',
        flex: 1,
        lineHeight: 18,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginLeft: 10,
    },
    retryText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.light.primary,
    },
});
