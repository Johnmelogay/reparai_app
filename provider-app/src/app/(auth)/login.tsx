import { Colors, Layout } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { logger } from '@/utils/logger';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Mail, Shield, Wrench } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
    const { signInWithEmail, signInWithGoogle, signInWithApple } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleEmailLogin = async () => {
        if (!email.trim()) {
            setError('Digite seu e-mail');
            return;
        }
        setError(null);
        setLoading(true);

        const { error: authError } = await signInWithEmail(email.trim().toLowerCase());

        if (authError) {
            logger.error('Login failed', authError);
            setError('Erro ao enviar código. Tente novamente.');
            setLoading(false);
            return;
        }

        setLoading(false);
        router.push({ pathname: '/(auth)/verify', params: { email: email.trim().toLowerCase() } });
    };

    const handleGoogleLogin = async () => {
        setError(null);
        setLoading(true);
        const { error } = await signInWithGoogle();
        if (error) {
            logger.error('Google login failed', error);
            setError('Erro ao entrar com Google.');
        }
        setLoading(false);
    };

    const handleAppleLogin = async () => {
        setError(null);
        setLoading(true);
        const { error } = await signInWithApple();
        if (error) {
            logger.error('Apple login failed', error);
            setError('Erro ao entrar com Apple.');
        }
        setLoading(false);
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <LinearGradient
                            colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
                            style={styles.iconGradient}
                        >
                            <Wrench size={32} color="#fff" />
                        </LinearGradient>
                    </View>
                    <Text style={styles.title}>Reparaí</Text>
                    <Text style={styles.subtitle}>Prestador</Text>
                    <Text style={styles.description}>
                        Receba pedidos, faça ofertas e atenda clientes na sua região.
                    </Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <View style={styles.inputWrapper}>
                        <Mail size={20} color={Colors.light.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Seu e-mail profissional"
                            placeholderTextColor={Colors.light.textMuted}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!loading}
                        />
                    </View>

                    {error && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.primaryButton, loading && styles.disabledButton]}
                        onPress={handleEmailLogin}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.buttonGradient}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.primaryButtonText}>Entrar com E-mail</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>ou</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Social buttons */}
                    <TouchableOpacity
                        style={styles.socialButton}
                        onPress={handleGoogleLogin}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.socialButtonText}>Entrar com Google</Text>
                    </TouchableOpacity>

                    {Platform.OS === 'ios' && (
                        <TouchableOpacity
                            style={[styles.socialButton, styles.appleButton]}
                            onPress={handleAppleLogin}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.socialButtonText, styles.appleButtonText]}>
                                Entrar com Apple
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Shield size={14} color={Colors.light.textMuted} />
                    <Text style={styles.footerText}>
                        Seus dados estão protegidos e seguros.
                    </Text>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: Layout.spacing.lg,
    },
    header: {
        alignItems: 'center',
        marginBottom: Layout.spacing.xl,
    },
    iconContainer: {
        marginBottom: Layout.spacing.md,
    },
    iconGradient: {
        width: 72,
        height: 72,
        borderRadius: Layout.radius.xl,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: Colors.light.text,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.light.primary,
        marginTop: 2,
    },
    description: {
        fontSize: 15,
        color: Colors.light.textSecondary,
        textAlign: 'center',
        marginTop: Layout.spacing.sm,
        lineHeight: 22,
        paddingHorizontal: Layout.spacing.xl,
    },
    form: {
        gap: Layout.spacing.md,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.light.card,
        borderRadius: Layout.radius.md,
        borderWidth: 1,
        borderColor: Colors.light.border,
        paddingHorizontal: Layout.spacing.md,
        height: 56,
    },
    inputIcon: {
        marginRight: Layout.spacing.sm,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: Colors.light.text,
    },
    errorContainer: {
        backgroundColor: '#FEF2F2',
        borderRadius: Layout.radius.sm,
        padding: Layout.spacing.sm,
    },
    errorText: {
        color: Colors.light.danger,
        fontSize: 13,
        textAlign: 'center',
    },
    primaryButton: {
        borderRadius: Layout.radius.md,
        overflow: 'hidden',
        height: 56,
    },
    disabledButton: {
        opacity: 0.7,
    },
    buttonGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Layout.spacing.xs,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.light.border,
    },
    dividerText: {
        marginHorizontal: Layout.spacing.md,
        color: Colors.light.textMuted,
        fontSize: 13,
    },
    socialButton: {
        backgroundColor: Colors.light.card,
        borderRadius: Layout.radius.md,
        borderWidth: 1,
        borderColor: Colors.light.border,
        height: 52,
        justifyContent: 'center',
        alignItems: 'center',
    },
    socialButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.light.text,
    },
    appleButton: {
        backgroundColor: '#000',
        borderColor: '#000',
    },
    appleButtonText: {
        color: '#fff',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        marginTop: Layout.spacing.xl,
    },
    footerText: {
        fontSize: 12,
        color: Colors.light.textMuted,
    },
});
