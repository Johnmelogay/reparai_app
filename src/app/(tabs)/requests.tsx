/**
 * File: src/app/(tabs)/requests.tsx
 * Purpose: "My Orders" screen displaying active and past services.
 * Key Features:
 * - Segmented Control for "Active" vs "History".
 * - Lists ServiceCards with detailed status (Analysis, Scheduled, In Progress, etc.).
 * - Integrates with shared data status logic.
 * - Navigation to Ticket Details or Chat.
 */
import { ServiceCard } from '@/components/ui/ServiceCard';
import { Colors, Layout } from '@/constants/Colors';
import { TicketStatus } from '@/types';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBottomSheet } from '@/components/modals/AuthBottomSheet';
import { useAuth } from '@/context/AuthContext';
import { ClipboardList } from 'lucide-react-native';

export default function RequestsScreen() {
    const router = useRouter();
    const { isGuest } = useAuth();
    const [showAuth, setShowAuth] = useState(false);
    const [filter, setFilter] = useState<'Active' | 'History'>('Active');

    // TODO: Connect to Real Backend
    // For now, if logged in, we show empty state unless we persist it somewhere.
    // The user explicitly asked to REMOVE placeholders.
    const activeTickets: any[] = [];
    const ledgerEntries: any[] = [];


    const filteredData = filter === 'Active'
        ? activeTickets
        : ledgerEntries;

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const getStatusLabel = (status: TicketStatus | string) => {
        const statusMap: Record<string, string> = {
            'NEW': 'Aguardando',
            'OFFERED': 'Propostas',
            'ACCEPTED': 'Aguardando Pagamento',
            'PAID': 'Confirmado',
            'EN_ROUTE': 'A caminho',
            'DONE': 'Concluído',
            'CANCELED': 'Cancelado',
            'In Progress': 'Em Andamento',
            'Completed': 'Concluído',
        };
        return statusMap[status] || status;
    };

    const getStatusColor = (status: TicketStatus | string) => {
        if (status === 'DONE' || status === 'Completed') return Colors.light.success;
        if (status === 'CANCELED' || status === 'Canceled') return '#EF4444';
        if (status === 'EN_ROUTE' || status === 'In Progress') return Colors.light.primary;
        return '#666';
    };

    const renderItem = ({ item, index }: { item: any; index: number }) => {
        const isHistory = filter === 'History';

        // Data Normalization for the new ServiceCard structure
        const statusMap: Record<string, any> = {
            'NEW': 'ANALYSIS',
            'OFFERED': 'WAITING_BUDGET',
            'ACCEPTED': 'SCHEDULED',
            'PAID': 'SCHEDULED',
            'EN_ROUTE': 'IN_PROGRESS',
            'DONE': 'FINISHED',
            'CANCELED': 'CANCELED'
        };

        const status = (isHistory ? 'FINISHED' : (statusMap[item.status] || 'ANALYSIS')) as any;
        const price = item.price ? `R$ ${item.price.toFixed(2)}` : item.servicePrice ? `R$ ${item.servicePrice.toFixed(2)}` : 'Sob consulta';
        const date = item.date ?
            new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) :
            new Date(item.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

        return (
            <ServiceCard
                orderIdShort={item.id.substring(1, 5)}
                status={status}
                title={item.service || item.description || 'Consulta de Serviço'}
                category={item.category || 'Manutenção Geral'}
                providerName={item.providerName || 'Buscando profissional...'}
                providerRating={4.8}
                providerVerified={true}
                providerImage={item.image}
                dateTime={`${date} • ${index % 2 === 0 ? '14:30' : '09:00'}`}
                locationLabel="Porto Velho - Centro"
                priceLabel={price}
                hasWarranty={item.warranty !== null && item.warranty !== undefined}
                warrantyStartDate={item.warranty?.startDate}
                warrantyEndDate={item.warranty?.endDate}
                onPress={() => {
                    if (item.id && !item.ledgerId) {
                        router.push(`/ticket/${item.id}`);
                    }
                }}
                onPrimaryAction={() => { }}
                onChatPress={() => router.push(`/chat/${item.id}`)}
                style={{ marginBottom: Layout.spacing.lg }}
            />
        );
    };

    if (isGuest) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]} edges={['top']}>
                <View style={{ alignItems: 'center', marginBottom: 40 }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                        <ClipboardList size={40} color="#9CA3AF" />
                    </View>
                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111', marginBottom: 10 }}>Seus Pedidos</Text>
                    <Text style={{ textAlign: 'center', color: '#666', fontSize: 16, lineHeight: 24 }}>
                        Faça login para acompanhar seus pedidos em andamento e ver seu histórico.
                    </Text>
                </View>

                <TouchableOpacity
                    style={{ backgroundColor: Colors.light.primary, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, width: '100%', alignItems: 'center' }}
                    onPress={() => setShowAuth(true)}
                >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Entrar</Text>
                </TouchableOpacity>

                <AuthBottomSheet
                    visible={showAuth}
                    onClose={() => setShowAuth(false)}
                    onSuccess={() => setShowAuth(false)}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Text style={styles.title}>Meus Pedidos</Text>

            {/* Segmented Control */}
            <View style={styles.segmentContainer}>
                <TouchableOpacity
                    style={[styles.segmentBtn, filter === 'Active' && styles.segmentBtnActive]}
                    onPress={() => setFilter('Active')}
                >
                    <Text style={[styles.segmentText, filter === 'Active' && styles.segmentTextActive]}>Em Andamento</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.segmentBtn, filter === 'History' && styles.segmentBtnActive]}
                    onPress={() => setFilter('History')}
                >
                    <Text style={[styles.segmentText, filter === 'History' && styles.segmentTextActive]}>Histórico</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={filteredData}
                renderItem={renderItem}
                keyExtractor={item => item.id || `item_${item.date}`}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                            {filter === 'Active'
                                ? 'Nenhum pedido em andamento.'
                                : 'Nenhum histórico encontrado.'}
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginHorizontal: Layout.spacing.lg,
        marginTop: Layout.spacing.lg,
        marginBottom: Layout.spacing.md,
    },
    segmentContainer: {
        flexDirection: 'row',
        marginHorizontal: Layout.spacing.lg,
        backgroundColor: Colors.light.background,
        borderRadius: Layout.radius.md,
        padding: 4,
        marginBottom: Layout.spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    segmentBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 10,
    },
    segmentBtnActive: {
        backgroundColor: '#fff',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    segmentText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#999',
    },
    segmentTextActive: {
        color: '#333',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 100, // Space for nav
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: Layout.radius.lg,
        marginBottom: Layout.spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        ...Layout.shadows.small,
        overflow: 'hidden',
    },
    mainContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
    },
    cardImage: {
        width: 60,
        height: 60,
        borderRadius: 12,
        backgroundColor: '#eee',
    },
    cardImagePlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 12,
        backgroundColor: Colors.light.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardImageText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.light.primary,
    },
    cardContent: {
        flex: 1,
        marginLeft: 15,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    providerName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    serviceName: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingRight: 10,
    },
    date: {
        fontSize: 12,
        color: '#999',
    },
    price: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.light.primary,
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 50,
    },
    emptyText: {
        color: '#999',
        fontSize: 16,
    },
    warrantyContainer: {
        backgroundColor: '#F9FAFB',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        padding: 10,
    },
});
