import { Colors, Layout } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { ChevronRight, CircleHelp, CreditCard, Heart, LogOut, MessageCircle, User } from 'lucide-react-native';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MENU_ITEMS = [
    { icon: MessageCircle, label: 'Mensagens', route: '/chat' },
    { icon: Heart, label: 'Favoritos', route: '/favorites' },
    { icon: User, label: 'Editar Perfil', route: '/profile/edit' },
    { icon: CreditCard, label: 'Pagamentos', route: '/profile/payments' },
    { icon: CircleHelp, label: 'Ajuda e Suporte', route: '/profile/help' },
];

export default function ProfileScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Image
                    source={{ uri: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=400&q=80' }}
                    style={styles.avatar}
                />
                <Text style={styles.name}>João Silva</Text>
                <Text style={styles.phone}>(69) 99312-9559</Text>

                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>12</Text>
                        <Text style={styles.statLabel}>Pedidos</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>4.9</Text>
                        <Text style={styles.statLabel}>Avaliação</Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.section}>
                    {MENU_ITEMS.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.menuItem}
                            onPress={() => item.route && router.push(item.route as any)}
                        >
                            <View style={styles.menuIconContainer}>
                                <item.icon size={20} color={Colors.light.primary} />
                            </View>
                            <Text style={styles.menuLabel}>{item.label}</Text>
                            <ChevronRight size={20} color="#ccc" />
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity style={styles.logoutButton}>
                    <LogOut size={20} color="#EF4444" style={{ marginRight: 10 }} />
                    <Text style={styles.logoutText}>Sair</Text>
                </TouchableOpacity>

                <Text style={styles.version}>Versão 1.0.0 (Beta)</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        alignItems: 'center',
        paddingVertical: 30,
        paddingHorizontal: 20,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 15,
        backgroundColor: '#eee',
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    phone: {
        fontSize: 16,
        color: '#666',
        marginBottom: 20,
    },
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.light.background,
        borderRadius: Layout.radius.lg,
        padding: 15,
        width: '100%',
        justifyContent: 'space-around',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.light.primary,
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
    },
    statDivider: {
        width: 1,
        backgroundColor: '#E5E7EB',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: Layout.radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        ...Layout.shadows.small,
        overflow: 'hidden',
        marginBottom: Layout.spacing.lg,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    menuIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 15,
    },
    menuLabel: {
        flex: 1,
        fontSize: 16,
        color: '#333',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        borderRadius: Layout.radius.lg,
        backgroundColor: '#FEF2F2', // Mantendo o tom de erro sutil
        marginBottom: Layout.spacing.lg,
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    logoutText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: 'bold',
    },
    version: {
        textAlign: 'center',
        color: '#ccc',
        fontSize: 12,
    }
});
