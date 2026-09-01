import { AuthBottomSheet } from '@/components/modals/AuthBottomSheet';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useChatInbox } from '@/hooks/useChatInbox';
import { useMyRequests } from '@/hooks/useMyRequests';
import { useNotifications as useNotificationsHook } from '@/hooks/useNotifications';
import { markChatThreadAsRead } from '@/services/chatService';
import { Notification } from '@/types';
import { getClientActionLabel, needsClientAction } from '@/utils/orderActions';
import { useRouter } from 'expo-router';
import { Bell, CheckCheck, MessageCircle } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Helper function to format time
function formatTime(timestamp?: string | null): string {
    if (!timestamp) return '';
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
        nonMessageNotifications,
        loading: loadingNotifications,
        unreadNonMessageCount,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
    } = useNotificationsHook();

    const {
        threads: chatThreads,
        loading: loadingThreads,
        refetch: refetchChatInbox,
    } = useChatInbox();

    const { allRequests } = useMyRequests();
    const pendingActions = allRequests.filter((request) => needsClientAction(request.status));

    const totalUnreadChatThreads = chatThreads.filter((t) => t.unreadCount > 0).length;
    const hasAnyUnread = totalUnreadChatThreads > 0 || unreadNonMessageCount > 0;

    const handleMarkAllAsRead = async () => {
        try {
            await markAllAsRead();
            const unreadThreads = chatThreads.filter((t) => t.unreadCount > 0);
            await Promise.all(
                unreadThreads.map((t) => markChatThreadAsRead(t.requestId).catch(() => 0))
            );
            refetchChatInbox();
            fetchNotifications();
        } catch (e) {
            console.warn('Erro ao marcar todas como lidas:', e);
        }
    };

    const handlePressNotification = (item: Notification) => {
        if (!item.is_read) {
            markAsRead(item.id);
        }
        if (item.related_id) {
            if (item.type === 'offer') {
                router.push({ pathname: '/request/new/match', params: { requestId: item.related_id } } as any);
            } else {
                router.push(`/ticket/${item.related_id}` as any);
            }
        }
    };

    const handleOpenTicket = (ticketId: string, status: string) => {
        if (status === 'finding' || status === 'offered') {
            router.push({ pathname: '/request/new/match', params: { requestId: ticketId } } as any);
        } else {
            router.push(`/ticket/${ticketId}` as any);
        }
    };

    const onRefresh = async () => {
        await Promise.all([fetchNotifications(), refetchChatInbox()]);
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

    const isLoading = (loadingNotifications && nonMessageNotifications.length === 0) || (loadingThreads && chatThreads.length === 0);
    const isEmpty = chatThreads.length === 0 && nonMessageNotifications.length === 0 && pendingActions.length === 0;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>Notificações</Text>
                {hasAnyUnread && (
                    <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllButton}>
                        <CheckCheck size={18} color={Colors.light.primary} />
                        <Text style={styles.markAllText}>Marcar todas</Text>
                    </TouchableOpacity>
                )}
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={loadingNotifications || loadingThreads}
                            onRefresh={onRefresh}
                            tintColor={Colors.light.primary}
                        />
                    }
                >
                    {/* 1. SEÇÃO DE AÇÕES PENDENTES */}
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

                    {/* 2. ÁREA: MENSAGENS (CONVERSAS AGRUPADAS POR REQUEST_ID) */}
                    {chatThreads.length > 0 && (
                        <View style={styles.sectionWrap}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>Mensagens</Text>
                                {totalUnreadChatThreads > 0 && (
                                    <View style={styles.sectionBadge}>
                                        <Text style={styles.sectionBadgeText}>{totalUnreadChatThreads}</Text>
                                    </View>
                                )}
                            </View>

                            {chatThreads.map((thread) => {
                                const hasUnread = thread.unreadCount > 0;
                                return (
                                    <TouchableOpacity
                                        key={thread.requestId}
                                        style={[styles.threadCard, hasUnread && styles.threadCardUnread]}
                                        onPress={() => router.push(`/chat/${thread.requestId}` as any)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.avatarWrap}>
                                            <Text style={styles.avatarText}>
                                                {(thread.provider?.name || 'P').slice(0, 1).toUpperCase()}
                                            </Text>
                                        </View>

                                        <View style={styles.threadInfo}>
                                            <View style={styles.threadTopRow}>
                                                <Text style={styles.providerName} numberOfLines={1}>
                                                    {thread.provider?.name || 'Prestador'}
                                                </Text>
                                                <Text style={styles.timeText}>
                                                    {formatTime(thread.lastMessageAt || thread.updatedAt)}
                                                </Text>
                                            </View>

                                            <Text style={styles.categorySub} numberOfLines={1}>
                                                {thread.category || 'Serviço'}
                                            </Text>

                                            <Text style={[styles.lastMessagePreview, hasUnread && styles.lastMessagePreviewUnread]} numberOfLines={1}>
                                                {thread.lastMessage || 'Toque para abrir a conversa'}
                                            </Text>
                                        </View>

                                        {hasUnread && (
                                            <View style={styles.unreadPill}>
                                                <Text style={styles.unreadPillText}>
                                                    {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                                                </Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {/* 3. ÁREA: ATUALIZAÇÕES (NOTIFICAÇÕES NÃO-MENSAGEM) */}
                    {nonMessageNotifications.length > 0 && (
                        <View style={styles.sectionWrap}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>Atualizações</Text>
                                {unreadNonMessageCount > 0 && (
                                    <View style={styles.sectionBadge}>
                                        <Text style={styles.sectionBadgeText}>{unreadNonMessageCount}</Text>
                                    </View>
                                )}
                            </View>

                            {nonMessageNotifications.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[styles.notifItem, !item.is_read && styles.notifItemUnread]}
                                    onPress={() => handlePressNotification(item)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.iconContainer}>
                                        <Bell size={18} color={!item.is_read ? Colors.light.primary : '#9CA3AF'} />
                                    </View>
                                    <View style={styles.notifTextContainer}>
                                        <Text style={styles.notifItemTitle}>{item.title || 'Notificação'}</Text>
                                        <Text style={styles.notifItemBody}>{item.message}</Text>
                                        <Text style={styles.notifItemTime}>{formatTime(item.created_at)}</Text>
                                    </View>
                                    {!item.is_read && <View style={styles.unreadDot} />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* 4. ESTADO VAZIO */}
                    {isEmpty && (
                        <View style={styles.emptyContainer}>
                            <Bell size={48} color="#D1D5DB" strokeWidth={1.5} />
                            <Text style={styles.emptyText}>Nenhuma notificação nova</Text>
                            <Text style={styles.emptySubtext}>Você receberá atualizações sobre seus pedidos e mensagens aqui</Text>
                        </View>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1E293B',
    },
    markAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    markAllText: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.light.primary,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 32,
    },
    sectionWrap: {
        marginTop: 14,
        marginBottom: 8,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        paddingHorizontal: 4,
        gap: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#334155',
    },
    sectionBadge: {
        backgroundColor: Colors.light.primary + '20',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    sectionBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: Colors.light.primary,
    },
    pendingSection: {
        marginTop: 6,
        marginBottom: 8,
        backgroundColor: '#FFF7ED',
        borderWidth: 1,
        borderColor: '#FED7AA',
        borderRadius: 14,
        padding: 12,
        gap: 10,
    },
    pendingTitle: {
        fontSize: 13,
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
        fontSize: 13,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 2,
    },
    pendingCardDescription: {
        fontSize: 12,
        color: '#6B7280',
    },
    pendingMore: {
        fontSize: 11,
        fontWeight: '600',
        color: '#B45309',
    },
    threadCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
    },
    threadCardUnread: {
        backgroundColor: '#F8FAFC',
        borderColor: Colors.light.primary + '50',
    },
    avatarWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.light.primary + '18',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.light.primary,
    },
    threadInfo: {
        flex: 1,
        marginRight: 8,
    },
    threadTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    providerName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E293B',
        flex: 1,
        marginRight: 6,
    },
    timeText: {
        fontSize: 11,
        color: '#94A3B8',
    },
    categorySub: {
        fontSize: 11,
        fontWeight: '600',
        color: Colors.light.primary,
        marginBottom: 3,
    },
    lastMessagePreview: {
        fontSize: 13,
        color: '#64748B',
    },
    lastMessagePreviewUnread: {
        fontWeight: '600',
        color: '#0F172A',
    },
    unreadPill: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: Colors.light.primary,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    unreadPillText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
    },
    notifItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        borderRadius: 12,
        padding: 12,
        marginBottom: 6,
    },
    notifItemUnread: {
        backgroundColor: '#F0F9FF',
        borderColor: '#BAE6FD',
    },
    iconContainer: {
        marginRight: 10,
        marginTop: 2,
    },
    notifTextContainer: {
        flex: 1,
    },
    notifItemTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 2,
    },
    notifItemBody: {
        fontSize: 12,
        color: '#475569',
        marginBottom: 4,
        lineHeight: 16,
    },
    notifItemTime: {
        fontSize: 11,
        color: '#94A3B8',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.light.primary,
        marginTop: 4,
        marginLeft: 6,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 40,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#475569',
        marginTop: 14,
        marginBottom: 6,
    },
    emptySubtext: {
        fontSize: 13,
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 18,
    },
});
