/**
 * ErrorBoundary — Catches React render errors and shows a retry screen.
 *
 * Wrap this around the entire app tree in _layout.tsx so that
 * unhandled render errors never result in a white/blank screen.
 */
import { Colors } from '@/constants/Colors';
import { logger } from '@/utils/logger';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        logger.error('ErrorBoundary caught a render error', {
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
        });
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <View style={styles.content}>
                        <Text style={styles.emoji}>⚠️</Text>
                        <Text style={styles.title}>Algo deu errado</Text>
                        <Text style={styles.message}>
                            Ocorreu um erro inesperado. Tente novamente ou reinicie o app.
                        </Text>

                        {__DEV__ && this.state.error && (
                            <View style={styles.debugBox}>
                                <Text style={styles.debugTitle}>Debug Info:</Text>
                                <Text style={styles.debugText} numberOfLines={8}>
                                    {this.state.error.message}
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
                            <Text style={styles.retryText}>Tentar Novamente</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    content: {
        alignItems: 'center',
        maxWidth: 320,
    },
    emoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    debugBox: {
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        padding: 16,
        width: '100%',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    debugTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#991B1B',
        marginBottom: 6,
    },
    debugText: {
        fontSize: 12,
        color: '#B91C1C',
        fontFamily: 'monospace',
    },
    retryButton: {
        backgroundColor: Colors.light.primary,
        paddingVertical: 14,
        paddingHorizontal: 40,
        borderRadius: 12,
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    retryText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
