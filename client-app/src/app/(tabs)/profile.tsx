/**
 * File: src/app/(tabs)/profile.tsx
 * Purpose: User Profile and Account Settings screen.
 */
import { AuthBottomSheet } from '@/components/modals/AuthBottomSheet';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { Award, ChevronRight, CircleHelp, Clock, CreditCard, Heart, LogOut, MessageCircle, Shield, Sparkles, User } from 'lucide-react-native';
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MENU_ITEMS = [
    { icon: MessageCircle, label: 'Mensagens', route: '/chat' },
    { icon: Heart, label: 'Favoritos', route: '/favorites' },
    { icon: User, label: 'Editar Perfil', route: '/profile/edit' },
    { icon: CreditCard, label: 'Pagamentos', route: '/profile/payments' },
    { icon: CircleHelp, label: 'Ajuda e Suporte', route: '/profile/help' },
];

const GUEST_BENEFITS = [
    { icon: Sparkles, text: 'Pedidos salvos e histórico completo' },
    { icon: Shield, text: 'Proteção e garantia em todos os serviços' },
    { icon: Clock, text: 'Acompanhamento em tempo real' },
    { icon: Award, text: 'Programa de recompensas exclusivo' },
];

import { useProfile } from '@/hooks/useProfile';

export default function ProfileScreen() {
    const router = useRouter();
    const { isGuest, signOut } = useAuth();
    const { profile, loading } = useProfile();
    const [showAuth, setShowAuth] = useState(false);

    // GUEST MODE
    if (isGuest) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.guestContainer}>
                    {/* Hero Section */}
                    <View style={styles.guestHero}>
                        <View style={styles.guestAvatarContainer}>
                            <User size={48} color={Colors.light.primary} strokeWidth={1.5} />
                        </View>
                        <Text style={styles.guestTitle}>Bem-vindo ao Reparaí</Text>
                        <Text style={styles.guestSubtitle}>
                            Entre ou crie sua conta para aproveitar todos os benefícios
                        </Text>
                    </View>

                    {/* CTA Buttons */}
                    <View style={styles.ctaContainer}>
                        <TouchableOpacity
                            style={styles.primaryCta}
                            onPress={() => setShowAuth(true)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.primaryCtaText}>Criar conta grátis</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryCta}
                            onPress={() => setShowAuth(true)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.secondaryCtaText}>Já tenho conta</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.guestFooter}>
                        Ao continuar, você concorda com nossos{'\n'}
                        Termos de Uso e Política de Privacidade
                    </Text>
                </View>

                <AuthBottomSheet
                    visible={showAuth}
                    onClose={() => setShowAuth(false)}
                    onSuccess={() => setShowAuth(false)}
                />
            </SafeAreaView>
        );
    }

    // LOGGED IN MODE
    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView>
                <View style={styles.header}>
                    {loading ? (
                        <View style={styles.avatarPlaceholder}>
                            <User size={40} color="#D1D5DB" />
                        </View>
                    ) : profile?.avatar_url ? (
                        <Image
                            source={{ uri: profile.avatar_url }}
                            style={styles.avatar}
                        />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <User size={48} color={Colors.light.primary} strokeWidth={1.5} />
                        </View>
                    )}
                    <Text style={styles.name}>
                        {loading ? 'Carregando...' : (profile?.full_name || 'Usuário Reparaí')}
                    </Text>
                    <Text style={styles.phone}>
                        {loading ? '...' : (profile?.phone || 'Sem telefone cadastrado')}
                    </Text>

                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>-</Text>
                            <Text style={styles.statLabel}>Pedidos</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>-</Text>
                            <Text style={styles.statLabel}>Avaliação</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.scrollContent}>
                    <View style={styles.section}>
                        {MENU_ITEMS.map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.menuItem,
                                    index === MENU_ITEMS.length - 1 && styles.menuItemLast
                                ]}
                                onPress={() => item.route && router.push(item.route as any)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.menuIconContainer}>
                                    <item.icon size={20} color={Colors.light.primary} strokeWidth={2} />
                                </View>
                                <Text style={styles.menuLabel}>{item.label}</Text>
                                <ChevronRight size={20} color="#D1D5DB" />
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity style={styles.logoutButton} onPress={signOut} activeOpacity={0.7}>
                        <LogOut size={20} color="#EF4444" strokeWidth={2} />
                        <Text style={styles.logoutText}>Sair da conta</Text>
                    </TouchableOpacity>

                    <Text style={styles.version}>Versão 1.0.0 (Beta)</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },

    // === GUEST STYLES ===
    guestContainer: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
        paddingBottom: 60,
    },
    guestHero: {
        alignItems: 'center',
        marginBottom: 60,
    },
    guestAvatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#FFFFFF',
        borderWidth: 3,
        borderColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    guestTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
        textAlign: 'center',
    },
    guestSubtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 20,
    },
    ctaContainer: {
        gap: 12,
        marginBottom: 32,
    },
    primaryCta: {
        backgroundColor: Colors.light.primary,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryCtaText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    secondaryCta: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    secondaryCtaText: {
        color: '#374151',
        fontSize: 17,
        fontWeight: '600',
    },
    guestFooter: {
        fontSize: 12,
        color: '#9CA3AF',
        textAlign: 'center',
        lineHeight: 18,
    },

    // === LOGGED IN STYLES ===
    header: {
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 24,
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 16,
        backgroundColor: '#F3F4F6',
        borderWidth: 3,
        borderColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 16,
        backgroundColor: '#F3F4F6',
        borderWidth: 3,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    name: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    phone: {
        fontSize: 15,
        color: '#6B7280',
        marginBottom: 24,
    },
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: Colors.light.primary,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
    },
    statDivider: {
        width: 1,
        backgroundColor: '#E5E7EB',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 100,
    },
    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    menuItemLast: {
        borderBottomWidth: 0,
    },
    menuIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFF7ED',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    menuLabel: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
        color: '#374151',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 14,
        backgroundColor: '#FEF2F2',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#FEE2E2',
        gap: 10,
    },
    logoutText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: '600',
    },
    version: {
        textAlign: 'center',
        color: '#D1D5DB',
        fontSize: 12,
        marginTop: 8,
    }
});
