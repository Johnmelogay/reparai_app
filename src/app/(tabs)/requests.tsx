import { ServiceCard } from '@/components/ui/ServiceCard';
import { Colors, Layout } from '@/constants/Colors';
import { TicketStatus } from '@/types';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RequestsScreen() {
    const router = useRouter();
    const [filter, setFilter] = useState<'Active' | 'History'>('Active');

    // Combine active tickets and ledger entries
    const activeTickets = [
        {
            id: 't1',
            status: 'NEW',
            providerName: 'João da Silva',
            description: 'Instalação de ar condicionado',
            category: 'Ar Condicionado',
            createdAt: '2025-12-26T10:00:00Z',
            servicePrice: 250.00,
            image: 'https://via.placeholder.com/150/FF5733/FFFFFF?text=AC',
            warranty: {
                startDate: '2025-12-26T10:00:00Z',
                endDate: '2026-03-26T10:00:00Z',
                description: 'Garantia protegida Reparaí.'
            }
        },
        {
            id: 't2',
            status: 'OFFERED',
            providerName: 'Maria Souza',
            description: 'Reparo de vazamento',
            category: 'Encanamento',
            createdAt: '2023-10-25T14:30:00Z',
            servicePrice: 180.00,
            image: 'https://via.placeholder.com/150/33FF57/FFFFFF?text=Encanamento'
        },
        {
            id: 't3',
            status: 'ACCEPTED',
            providerName: 'Pedro Santos',
            description: 'Limpeza de caixa d\'água',
            category: 'Limpeza',
            createdAt: '2023-10-24T09:00:00Z',
            servicePrice: 120.00,
            image: 'https://via.placeholder.com/150/3357FF/FFFFFF?text=Limpeza'
        },
        {
            id: 't4',
            status: 'PAID',
            providerName: 'Ana Costa',
            description: 'Manutenção elétrica',
            category: 'Eletricista',
            createdAt: '2023-10-23T11:00:00Z',
            servicePrice: 300.00,
            image: 'https://via.placeholder.com/150/FF33A1/FFFFFF?text=Eletricista'
        },
        {
            id: 't5',
            status: 'EN_ROUTE',
            providerName: 'Carlos Oliveira',
            description: 'Montagem de móveis',
            category: 'Montador',
            createdAt: '2023-10-22T16:00:00Z',
            servicePrice: 150.00,
            image: 'https://via.placeholder.com/150/A1FF33/FFFFFF?text=Montador'
        },
    ].filter(t =>
        t.status !== 'DONE' && t.status !== 'CANCELED'
    );

    const ledgerEntries = [
        {
            id: 'l1',
            ledgerId: 'L001',
            providerName: 'Clima Bom',
            service: 'Manutenção AC',
            date: '2025-11-20T10:00:00Z',
            price: 250.00,
            warranty: {
                startDate: '2025-11-20T10:00:00Z',
                endDate: '2026-02-20T10:00:00Z', // Active
                description: 'Garantia de 3 meses para o serviço de manutenção.',
            },
            image: 'https://via.placeholder.com/150/FF5733/FFFFFF?text=AC'
        },
        {
            id: 'l2',
            ledgerId: 'L002',
            providerName: 'Borracharia JP',
            service: 'Troca de Pneu',
            date: '2023-10-15T14:00:00Z',
            price: 80.00,
            warranty: null,
            image: 'https://via.placeholder.com/150/33FF57/FFFFFF?text=Pneu'
        },
        {
            id: 'l3',
            ledgerId: 'L003',
            providerName: 'Eletricista Silva',
            service: 'Instalação de Tomada',
            date: '2025-12-10T09:00:00Z',
            price: 100.00,
            warranty: {
                startDate: '2025-12-10T09:00:00Z',
                endDate: '2026-04-10T09:00:00Z', // Clearly ACTIVE
                description: 'Garantia de 6 meses para a instalação elétrica.',
            },
            image: 'https://via.placeholder.com/150/3357FF/FFFFFF?text=Eletricista'
        },
        {
            id: 'l4',
            ledgerId: 'L004',
            providerName: 'Encanador Souza',
            service: 'Desentupimento',
            date: '2023-10-05T11:00:00Z',
            price: 150.00,
            warranty: null,
            image: 'https://via.placeholder.com/150/FF33A1/FFFFFF?text=Encanador'
        },
        {
            id: 'l5',
            ledgerId: 'L005',
            providerName: 'Jardineiro Verde',
            service: 'Corte de Grama',
            date: '2023-09-30T16:00:00Z',
            price: 70.00,
            warranty: null,
            image: 'https://via.placeholder.com/150/A1FF33/FFFFFF?text=Jardim'
        },
    ];

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
