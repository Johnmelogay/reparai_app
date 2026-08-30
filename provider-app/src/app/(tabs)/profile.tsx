import { Colors, Layout } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useProviderProfile } from '@/hooks/useProviderProfile';
import { categoryLabel } from '@/utils/category';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { confirmAction } from '@/utils/confirmAction';
import {
    ChevronRight,
    HelpCircle,
    LogOut,
    MapPin,
    Settings,
    Sparkles,
    Star,
    User,
    Wrench,
} from 'lucide-react-native';
import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/services/supabase';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react-native';

function useProviderStats(userId: string | undefined) {
    return useQuery({
        queryKey: ['providerStats', userId],
        queryFn: async () => {
            if (!userId) return { pedidos: '-' };
            
            const { count: pedidosCount } = await supabase
                .from('requests')
                .select('*', { count: 'exact', head: true })
                .eq('provider_id', userId)
                .eq('status', 'done');

            return {
                pedidos: pedidosCount ?? 0,
            };
        },
        enabled: !!userId,
    });
}

function MenuRow({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress?: () => void }) {
    return (
        <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
            {icon}
            <Text style={styles.menuLabel}>{label}</Text>
            <ChevronRight size={18} color={Colors.light.textMuted} />
        </TouchableOpacity>
    );
}

export default function ProfileScreen() {
    const router = useRouter();
    const { signOut, user } = useAuth();
    const { profile } = useProviderProfile();
    const { data: stats } = useProviderStats(user?.id);

    const handleSignOut = async () => {
        const confirmed = await confirmAction({
            title: 'Sair',
            message: 'Tem certeza que deseja sair?',
            confirmLabel: 'Sair',
            cancelLabel: 'Cancelar',
            destructive: true,
        });
        if (confirmed) {
            await signOut();
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Profile Header */}
                <LinearGradient
                    colors={['#1A1A2E', '#16213E']}
                    style={styles.headerGradient}
                >
                    <View style={styles.avatarContainer}>
                        {profile?.avatar_url ? (
                            <ExpoImage
                                source={{ uri: profile.avatar_url }}
                                style={styles.avatar}
                                contentFit="cover"
                            />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <User size={36} color="#fff" />
                            </View>
                        )}
                    </View>
                    <Text style={styles.profileName}>
                        {profile?.full_name || 'Prestador'}
                    </Text>
                    <Text style={styles.profileEmail}>
                        {user?.email || ''}
                    </Text>

                    {/* Stats */}
                    <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                            <Star size={16} color={Colors.light.secondary} />
                            <Text style={styles.statBoxValue}>
                                {profile?.rating?.toFixed(1) || '—'}
                            </Text>
                            <Text style={styles.statBoxLabel}>Avaliação</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statBox}>
                            <CheckCircle2 size={16} color={Colors.light.success} />
                            <Text style={styles.statBoxValue}>
                                {stats?.pedidos ?? '-'}
                            </Text>
                            <Text style={styles.statBoxLabel}>Pedidos</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statBox}>
                            <Wrench size={16} color={Colors.light.accent} />
                            <Text style={styles.statBoxValue}>
                                {categoryLabel(profile?.service_category)}
                            </Text>
                            <Text style={styles.statBoxLabel}>Categoria</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statBox}>
                            <MapPin size={16} color={Colors.light.primary} />
                            <Text style={styles.statBoxValue}>
                                {profile?.type === 'FIXED' ? 'Oficina' : 'Móvel'}
                            </Text>
                            <Text style={styles.statBoxLabel}>Tipo</Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* Menu */}
                <View style={styles.menuSection}>
                    <MenuRow
                        icon={<User size={20} color={Colors.light.text} />}
                        label="Editar Perfil"
                        onPress={() => router.push('/profile/edit')}
                    />
                    <MenuRow
                        icon={<Sparkles size={20} color={Colors.light.primary} />}
                        label="Destaques"
                        onPress={() => router.push('/profile/highlights')}
                    />
                    <MenuRow
                        icon={<Settings size={20} color={Colors.light.text} />}
                        label="Configurações"
                    />
                    <MenuRow
                        icon={<HelpCircle size={20} color={Colors.light.text} />}
                        label="Ajuda & Suporte"
                    />
                </View>

                <View style={styles.menuSection}>
                    <TouchableOpacity style={styles.logoutRow} onPress={handleSignOut} activeOpacity={0.7}>
                        <LogOut size={20} color={Colors.light.danger} />
                        <Text style={styles.logoutText}>Sair da Conta</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.versionText}>Reparaí Prestador v1.0.0</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
    headerGradient: {
        alignItems: 'center',
        paddingTop: Layout.spacing.xl,
        paddingBottom: Layout.spacing.lg,
        paddingHorizontal: Layout.spacing.lg,
    },
    avatarContainer: { marginBottom: Layout.spacing.md },
    avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#ffffff30' },
    avatarPlaceholder: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: '#ffffff20', justifyContent: 'center', alignItems: 'center',
        borderWidth: 3, borderColor: '#ffffff30',
    },
    profileName: { fontSize: 22, fontWeight: '800', color: '#fff' },
    profileEmail: { fontSize: 14, color: '#ffffff80', marginTop: 2 },
    statsRow: {
        flexDirection: 'row', marginTop: Layout.spacing.lg,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: Layout.radius.md,
        paddingVertical: Layout.spacing.md, paddingHorizontal: Layout.spacing.sm,
        width: '100%',
    },
    statBox: { flex: 1, alignItems: 'center', gap: 4 },
    statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
    statBoxValue: { fontSize: 15, fontWeight: '700', color: '#fff' },
    statBoxLabel: { fontSize: 11, color: '#ffffff60' },
    menuSection: {
        marginHorizontal: Layout.spacing.md, marginTop: Layout.spacing.md,
        backgroundColor: Colors.light.card, borderRadius: Layout.radius.lg,
        overflow: 'hidden',
    },
    menuRow: {
        flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.md,
        paddingVertical: Layout.spacing.md, paddingHorizontal: Layout.spacing.md,
        borderBottomWidth: 1, borderBottomColor: Colors.light.border + '40',
    },
    menuLabel: { flex: 1, fontSize: 16, fontWeight: '500', color: Colors.light.text },
    logoutRow: {
        flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.md,
        paddingVertical: Layout.spacing.md, paddingHorizontal: Layout.spacing.md,
    },
    logoutText: { fontSize: 16, fontWeight: '600', color: Colors.light.danger },
    versionText: {
        textAlign: 'center', fontSize: 12, color: Colors.light.textMuted,
        marginVertical: Layout.spacing.xl,
    },
});
