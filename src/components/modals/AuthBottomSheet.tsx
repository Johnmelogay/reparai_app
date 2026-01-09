
import { Colors, Layout } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { CheckCircle, Mail, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';

interface AuthBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type AuthStep = 'START' | 'EMAIL_OTP' | 'SUCCESS';

export function AuthBottomSheet({ visible, onClose, onSuccess }: AuthBottomSheetProps) {
    const { signInWithGoogle, signInWithApple, signInWithEmail, verifyEmailOtp } = useAuth();

    const [step, setStep] = useState<AuthStep>('START');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);

    // Reset state when opening
    useEffect(() => {
        if (visible) {
            setStep('START');
            setEmail('');
            setOtp('');
            setLoading(false);
        }
    }, [visible]);

    const handleOAuth = async (provider: 'google' | 'apple') => {
        setLoading(true);
        const { error } = provider === 'google' ? await signInWithGoogle() : await signInWithApple();
        // Note: OAuth flow finishes when deep link returns, handled by Context.
        // We might want to close modal if successful, but usually the app reloads state.
        setLoading(false);
        if (error) Alert.alert("Erro no login", error.message);
        else {
            // We can assume if no error, the browser opened.
            // The success callback depends on AuthContext updating session.
        }
    };

    const handleSendEmailCode = async () => {
        if (!email.includes('@')) {
            Alert.alert("Erro", "E-mail inválido.");
            return;
        }

        setLoading(true);
        const { error } = await signInWithEmail(email);
        setLoading(false);

        if (error) {
            Alert.alert("Erro", error.message);
        } else {
            setStep('EMAIL_OTP');
        }
    };

    const handleVerifyOtp = async () => {
        if (otp.length < 6) return;

        setLoading(true);
        const { error, session } = await verifyEmailOtp(email, otp);
        setLoading(false);

        if (error) {
            Alert.alert("Código inválido", "Tente novamente.");
        } else if (session) {
            setStep('SUCCESS');
            setTimeout(() => {
                onSuccess();
            }, 1000);
        }
    };

    const renderContent = () => {
        switch (step) {
            case 'START':
                return (
                    <>
                        <Text style={styles.title}>Criar conta ou entrar</Text>
                        <Text style={styles.subtitle}>
                            Salve seu progresso e encontre os melhores profissionais.
                        </Text>

                        {/* OAuth Buttons */}
                        <TouchableOpacity
                            style={[styles.oauthBtn, { backgroundColor: '#000' }]}
                            onPress={() => handleOAuth('apple')}
                        >
                            {/* Apple Icon placeholder or text */}
                            <Text style={[styles.btnText, { color: '#fff' }]}> Continuar com Apple</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.oauthBtn, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' }]}
                            onPress={() => handleOAuth('google')}
                        >
                            {/* Google Icon placeholder or text */}
                            <Text style={[styles.btnText, { color: '#333' }]}>G  Continuar com Google</Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
                            <View style={{ flex: 1, height: 1, backgroundColor: '#E5E5EA' }} />
                            <Text style={{ marginHorizontal: 10, color: '#999' }}>ou use e-mail</Text>
                            <View style={{ flex: 1, height: 1, backgroundColor: '#E5E5EA' }} />
                        </View>

                        <View style={styles.inputContainer}>
                            <Mail size={20} color={Colors.light.textSecondary} style={{ marginRight: 10 }} />
                            <TextInput
                                style={styles.input}
                                placeholder="seu@email.com"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                                onChangeText={setEmail}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.primaryBtn, loading && styles.disabledBtn]}
                            onPress={handleSendEmailCode}
                            disabled={loading || !email}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Continuar com E-mail</Text>}
                        </TouchableOpacity>
                    </>
                );

            case 'EMAIL_OTP':
                return (
                    <>
                        <TouchableOpacity onPress={() => setStep('START')} style={{ marginBottom: 10 }}>
                            <Text style={{ color: Colors.light.textSecondary }}>← Voltar</Text>
                        </TouchableOpacity>

                        <Text style={styles.title}>Verifique seu e-mail</Text>
                        <Text style={styles.subtitle}>
                            Enviamos um código de 6 dígitos para {email}
                        </Text>

                        <View style={styles.inputContainer}>
                            <TextInput
                                style={[styles.input, { letterSpacing: 8, textAlign: 'center', fontSize: 24 }]}
                                placeholder="000000"
                                keyboardType="number-pad"
                                maxLength={6}
                                value={otp}
                                onChangeText={setOtp}
                                autoFocus
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.primaryBtn, (loading || otp.length < 6) && styles.disabledBtn]}
                            onPress={handleVerifyOtp}
                            disabled={loading || otp.length < 6}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Confirmar Código</Text>}
                        </TouchableOpacity>
                    </>
                );

            case 'SUCCESS':
                return (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                        <CheckCircle size={64} color={Colors.light.primary} />
                        <Text style={[styles.title, { marginTop: 20 }]}>Bem-vindo!</Text>
                    </View>
                );
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.overlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.keyboardView}
                    >
                        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

                        <View style={styles.sheet}>
                            <View style={styles.header}>
                                <View style={styles.handle} />
                                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                    <X size={24} color="#333" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.content}>
                                {renderContent()}
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    keyboardView: {
        width: '100%',
        justifyContent: 'flex-end',
        flex: 1,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 40,
        width: '100%',
        ...Layout.shadows.medium,
    },
    header: {
        alignItems: 'center',
        paddingVertical: 12,
        position: 'relative',
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#E5E5EA',
        borderRadius: 2,
    },
    closeBtn: {
        position: 'absolute',
        right: 20,
        top: 20,
        zIndex: 10,
    },
    content: {
        paddingHorizontal: 24,
        paddingTop: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#111',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: '#666',
        marginBottom: 24,
        lineHeight: 22,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F2F2F7',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 56,
        marginBottom: 20,
    },
    input: {
        flex: 1,
        fontSize: 17,
        color: '#000',
        height: '100%',
    },
    primaryBtn: {
        backgroundColor: Colors.light.primary,
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        ...Layout.shadows.small,
    },
    disabledBtn: {
        opacity: 0.7,
    },
    btnText: {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#fff',
    },
    ghostBtn: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 10,
    },
    ghostBtnText: {
        fontSize: 15,
        color: Colors.light.primary,
        fontWeight: '600',
    },
    oauthBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        borderRadius: 12,
        marginBottom: 12,
        ...Layout.shadows.small,
    }
});
