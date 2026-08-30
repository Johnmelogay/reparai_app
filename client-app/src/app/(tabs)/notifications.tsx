import { AuthBottomSheet } from '@/components/modals/AuthBottomSheet';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useMyRequests } from '@/hooks/useMyRequests';
import { useNotifications as useNotificationsHook } from '@/hooks/useNotifications';
import { Notification } from '@/types';
import { getClientActionLabel, needsClientAction } from '@/utils/orderActions';
import { useRouter } from 'expo-router';
import { Bell, CheckCheck, MessageCircle } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Helper function to format notification time
function formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function NotificationsScreen() {
    const { isGuest } = useAuth();
    const [showAuth, setShowAuth] = useState(false);
    const router = useRouter();
    const {
        notifications,
        loading,
        unreadCount,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
    } = useNotificationsHook();
    const { allRequests } = useMyRequests();
    const pendingActions = allRequests.filter((request) => needsClientAction(request.status));

    const handlePressNotification = (item: Notification) => {
        // Marca como lida de forma assíncrona sem bloquear navegação
        if (!item.is_read) {
            markAsRead(item.id);
        }

        if (item.type === 'message' && item.related_id) {
            router.push(`/chat/${item.related_id}` as any);
        } else if (item.related_id) {
            router.push(`/ticket/${item.related_id}` as any);
        }
    };

    const handleOpenTicket = (ticketId: string, status: string) => {
        if (status === 'finding' || status === 'offered') {
            router.push('/request/new/match' as any);
        } else {
            router.push(`/ticket/${ticketId}` as any);
        }
    };

    if (isGuest) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]} edges={['top']}>
                <View style={{ alignItems: 'center', marginBottom: 40 }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                        <Bell size={40} color="#9CA3AF" />
                    </View>
                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111', marginBottom: 10 }}>Notificações</Text>
                    <Text style={{ textAlign: 'center', color: '#666', fontSize: 16, lineHeight: 24 }}>
                        Faça login para receber atualizações sobre seus pedidos e mensagens.
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
            <View style={styles.header}>
                <Text style={styles.title}>Notificações</Text>
                {unreadCount > 0 && (
                    <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
                        <CheckCheck size={18} color={Colors.light.primary} />
                        <Text style={styles.markAllText}>Marcar todas</Text>
                    </TouchableOpacity>
                )}
            </View>

            {pendingActions.length > 0 && (
                <View style={styles.pendingSection}>
                    <Text style={styles.pendingTitle}>Ações pendentes nos pedidos</Text>
                    {pendingActions.slice(0, 2).map((request) => (
                        <View key={request.id} style={styles.pendingCard}>
                            <View style={styles.pendingTextWrap}>
                                <Text style={styles.pendingCardTitle}>{request.category || 'Pedido'}</Text>
                                <Text style={styles.pendingCardDescription}>{getClientActionLabel(request.status)}</Text>
                            </View>
                            <Button
                                title="Abrir"
                                size="sm"
                                onPress={() => handleOpenTicket(request.id, request.status)}
                            />
                        </View>
                    ))}
                    {pendingActions.length > 2 && (
                        <Text style={styles.pendingMore}>+{pendingActions.length - 2} pedidos com ação pendente</Text>
                    )}
                </View>
            )}

            {loading && notifications.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={loading}
                            onRefresh={fetchNotifications}
                            tintColor={Colors.light.primary}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Bell size={48} color="#D1D5DB" strokeWidth={1.5} />
                            <Text style={styles.emptyText}>Nenhuma notificação nova</Text>
                            <Text style={styles.emptySubtext}>Você receberá atualizações sobre seus pedidos e mensagens aqui</Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const isMessage = item.type === 'message';
                        return (
                            <TouchableOpacity
                                style={[styles.item, !item.is_read && styles.unread]}
                                onPress={() => handlePressNotification(item)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.iconContainer}>
                                    {isMessage ? (
                                        <MessageCircle size={20} color={!item.is_read ? Colors.light.primary : '#9CA3AF'} />
                                    ) : (
                                        <Bell size={20} color={!item.is_read ? Colors.light.primary : '#9CA3AF'} />
                                    )}
                                </View>
                                <View style={styles.textContainer}>
                                    <Text style={styles.itemTitle}>{item.title || (isMessage ? 'Nova mensagem' : 'Notificação')}</Text>
                                    <Text style={styles.itemBody}>{item.message}</Text>
                                    <Text style={styles.itemTime}>{formatTime(item.created_at)}</Text>
                                </View>
                                {!item.is_read && <View style={styles.dot} />}
                            </TouchableOpacity>
                        );
                    }}
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
        color: '#333',
        marginHorizontal: 20,
        marginVertical: 20,
    },
    listContent: {
        paddingHorizontal: 20,
    },
    item: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        alignItems: 'flex-start',
    },
    unread: {
        backgroundColor: '#F0F9FF',
    },
    iconContainer: {
        marginRight: 12,
        marginTop: 2,
    },
    textContainer: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    itemBody: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    itemTime: {
        fontSize: 12,
        color: '#999',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.light.primary,
        marginTop: 6,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    pendingSection: {
        marginHorizontal: 20,
        marginBottom: 12,
        backgroundColor: '#FFF7ED',
        borderWidth: 1,
        borderColor: '#FED7AA',
        borderRadius: 14,
        padding: 12,
        gap: 10,
    },
    pendingTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#9A3412',
    },
    pendingCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FFEDD5',
        padding: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    pendingTextWrap: {
        flex: 1,
    },
    pendingCardTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 2,
    },
    pendingCardDescription: {
        fontSize: 13,
        color: '#6B7280',
    },
    pendingMore: {
        fontSize: 12,
        fontWeight: '600',
        color: '#B45309',
    },
    markAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    markAllText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.light.primary,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingTop: 80,
        paddingHorizontal: 40,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        lineHeight: 20,
    },
});
