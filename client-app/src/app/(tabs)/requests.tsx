/**
 * File: src/app/(tabs)/requests.tsx
 * Purpose: "My Orders" screen displaying active and past services.
 * Key Features:
 * - Segmented Control for "Active" vs "History".
 * - Lists ServiceCards with detailed status.
 * - Fetches real data from Supabase via useMyRequests hook.
 * - Navigation to Ticket Details or Chat.
 */
import { ServiceCard, ServiceStatus } from '@/components/ui/ServiceCard';
import { Colors, Layout } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBottomSheet } from '@/components/modals/AuthBottomSheet';
import { useAuth } from '@/context/AuthContext';
import { MyRequest, useMyRequests } from '@/hooks/useMyRequests';
import { ClipboardList } from 'lucide-react-native';

// Map Supabase status → ServiceCard status
const mapStatus = (dbStatus: string): ServiceStatus => {
    const map: Record<string, ServiceStatus> = {
        finding: 'ANALYSIS',
        offered: 'WAITING_BUDGET',
        accepted: 'SCHEDULED',
        paid: 'SCHEDULED',
        en_route: 'en_route',
        completed: 'FINISHED',
        canceled: 'canceled',
    };
    return map[dbStatus] || 'ANALYSIS';
};

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
    });
};

const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });
};

export default function RequestsScreen() {
    const router = useRouter();
    const { isGuest } = useAuth();
    const [showAuth, setShowAuth] = useState(false);
    const [filter, setFilter] = useState<'Active' | 'Done' | 'Canceled'>('Active');

    const { activeRequests = [], doneRequests = [], canceledRequests = [], loading, error, refetch } = useMyRequests();

    const filteredData = filter === 'Active' ? activeRequests : filter === 'Done' ? doneRequests : canceledRequests;

    const renderItem = ({ item }: { item: MyRequest }) => {
        const status = mapStatus(item.status);
        const price = item.displacement_fee
            ? `R$ ${Number(item.displacement_fee).toFixed(2).replace('.', ',')}`
            : 'Sob consulta';
        const dateStr = `${formatDate(item.created_at)} • ${formatTime(item.created_at)}`;

        // Build location label from address or fallback
        const locationLabel = item.address
            ? item.address.length > 35
                ? item.address.substring(0, 35) + '...'
                : item.address
            : 'Localização não informada';

        // Title: use AI summary, user_text, or category
        const title = item.ai_result_json?.problem_guess
            || item.user_text
            || item.category
            || 'Serviço solicitado';

        return (
            <ServiceCard
                orderIdShort={item.id.substring(0, 4).toUpperCase()}
                status={status}
                title={title}
                category={item.category || 'Geral'}
                providerName={item.provider_name || 'Buscando profissional...'}
                providerRating={item.provider_rating || undefined}
                providerVerified={!!item.provider_id}
                providerImage={item.provider_avatar || undefined}
                dateTime={dateStr}
                locationLabel={locationLabel}
                priceLabel={price}
                onPress={() => {
                    router.push(`/ticket/${item.id}`);
                }}
                onPrimaryAction={() => { }}
                onChatPress={() => {
                    if (item.provider_id) {
                        router.push(`/chat/${item.id}`);
                    }
                }}
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
                    <Text style={[styles.segmentText, filter === 'Active' && styles.segmentTextActive]}>
                        Andamento{activeRequests.length > 0 ? ` (${activeRequests.length})` : ''}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.segmentBtn, filter === 'Done' && styles.segmentBtnActive]}
                    onPress={() => setFilter('Done')}
                >
                    <Text style={[styles.segmentText, filter === 'Done' && styles.segmentTextActive]}>
                        Finalizados{doneRequests.length > 0 ? ` (${doneRequests.length})` : ''}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.segmentBtn, filter === 'Canceled' && styles.segmentBtnActive]}
                    onPress={() => setFilter('Canceled')}
                >
                    <Text style={[styles.segmentText, filter === 'Canceled' && styles.segmentTextActive]}>
                        Cancelados{canceledRequests.length > 0 ? ` (${canceledRequests.length})` : ''}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Error Banner */}
            {error && (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>⚠️ {error}</Text>
                    <TouchableOpacity onPress={() => refetch()}>
                        <Text style={styles.errorRetry}>Tentar novamente</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Loading State */}
            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                    <Text style={styles.loadingText}>Carregando pedidos...</Text>
                </View>
            )}

            {!loading && (
                <FlatList
                    data={filteredData}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={false}
                            onRefresh={() => refetch()}
                            colors={[Colors.light.primary]}
                            tintColor={Colors.light.primary}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconContainer}>
                                <ClipboardList size={48} color="#D1D5DB" />
                            </View>
                            <Text style={styles.emptyTitle}>
                                {filter === 'Active'
                                    ? 'Nenhum pedido em andamento'
                                    : filter === 'Done' ? 'Nenhum pedido finalizado' : 'Nenhum pedido cancelado'}
                            </Text>
                            <Text style={styles.emptySubtitle}>
                                {filter === 'Active'
                                    ? 'Quando você abrir um chamado, ele aparecerá aqui.'
                                    : 'Acompanhe seu status usando as outras categorias.'}
                            </Text>
                        </View>
                    }
                />
            )}
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
        paddingBottom: 100,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 80,
        paddingHorizontal: 40,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F9FAFB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        lineHeight: 20,
    },
    errorBanner: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 20,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    errorBannerText: {
        fontSize: 13,
        color: '#92400E',
        flex: 1,
    },
    errorRetry: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.light.primary,
        marginLeft: 10,
    },
    loadingContainer: {
        alignItems: 'center',
        marginTop: 80,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#999',
    },
});
