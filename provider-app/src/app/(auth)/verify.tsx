import { Colors, Layout } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { logger } from '@/utils/logger';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, KeyRound } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function VerifyScreen() {
    const { email } = useLocalSearchParams<{ email: string }>();
    const { verifyEmailOtp, signInWithEmail } = useAuth();
    const router = useRouter();

    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resending, setResending] = useState(false);
    const inputRefs = useRef<(TextInput | null)[]>([]);

    const handleCodeChange = (text: string, index: number) => {
        const newCode = [...code];
        newCode[index] = text;
        setCode(newCode);
        setError(null);

        // Auto-advance to next input
        if (text && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 digits entered
        if (text && index === 5) {
            const fullCode = newCode.join('');
            if (fullCode.length === 6) {
                handleVerify(fullCode);
            }
        }
    };

    const handleKeyPress = (key: string, index: number) => {
        if (key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (fullCode?: string) => {
        const token = fullCode || code.join('');
        if (token.length !== 6) {
            setError('Digite o código completo de 6 dígitos.');
            return;
        }
        if (!email) {
            setError('E-mail não encontrado. Volte e tente novamente.');
            return;
        }

        setError(null);
        setLoading(true);

        const { error: verifyError } = await verifyEmailOtp(email, token);

        if (verifyError) {
            logger.error('OTP verify failed', verifyError);
            setError('Código inválido ou expirado. Tente novamente.');
            setLoading(false);
            return;
        }

        setLoading(false);
        // Auth state change will handle navigation via _layout.tsx
    };

    const handleResend = async () => {
        if (!email || resending) return;
        setResending(true);
        setError(null);

        const { error } = await signInWithEmail(email);
        if (error) {
            setError('Erro ao reenviar código.');
        }
        setResending(false);
    };

    return (
        <SafeAreaView style={styles.container}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <ArrowLeft size={24} color={Colors.light.text} />
            </TouchableOpacity>

            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <KeyRound size={40} color={Colors.light.primary} />
                </View>

                <Text style={styles.title}>Verificação</Text>
                <Text style={styles.description}>
                    Enviamos um código de 6 dígitos para{'\n'}
                    <Text style={styles.emailText}>{email}</Text>
                </Text>

                {/* Code inputs */}
                <View style={styles.codeContainer}>
                    {code.map((digit, index) => (
                        <TextInput
                            key={index}
                            ref={(ref) => { inputRefs.current[index] = ref; }}
                            style={[
                                styles.codeInput,
                                digit ? styles.codeInputFilled : null,
                                error ? styles.codeInputError : null,
                            ]}
                            value={digit}
                            onChangeText={(text) => handleCodeChange(text, index)}
                            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                            keyboardType="number-pad"
                            maxLength={1}
                            editable={!loading}
                            selectTextOnFocus
                        />
                    ))}
                </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

                {loading && (
                    <ActivityIndicator size="small" color={Colors.light.primary} style={{ marginTop: 16 }} />
                )}

                <TouchableOpacity
                    style={styles.resendButton}
                    onPress={handleResend}
                    disabled={resending}
                >
                    <Text style={styles.resendText}>
                        {resending ? 'Reenviando...' : 'Reenviar código'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    backButton: {
        paddingHorizontal: Layout.spacing.md,
        paddingVertical: Layout.spacing.sm,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Layout.spacing.lg,
        marginTop: -60,
    },
    iconContainer: {
        marginBottom: Layout.spacing.md,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: Colors.light.text,
        marginBottom: Layout.spacing.sm,
    },
    description: {
        fontSize: 15,
        color: Colors.light.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: Layout.spacing.xl,
    },
    emailText: {
        fontWeight: '700',
        color: Colors.light.text,
    },
    codeContainer: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: Layout.spacing.md,
    },
    codeInput: {
        width: 48,
        height: 56,
        borderRadius: Layout.radius.md,
        borderWidth: 2,
        borderColor: Colors.light.border,
        backgroundColor: Colors.light.card,
        textAlign: 'center',
        fontSize: 24,
        fontWeight: '700',
        color: Colors.light.text,
    },
    codeInputFilled: {
        borderColor: Colors.light.primary,
    },
    codeInputError: {
        borderColor: Colors.light.danger,
    },
    errorText: {
        color: Colors.light.danger,
        fontSize: 13,
        textAlign: 'center',
        marginTop: Layout.spacing.sm,
    },
    resendButton: {
        marginTop: Layout.spacing.xl,
        padding: Layout.spacing.sm,
    },
    resendText: {
        color: Colors.light.primary,
        fontSize: 15,
        fontWeight: '600',
    },
});
