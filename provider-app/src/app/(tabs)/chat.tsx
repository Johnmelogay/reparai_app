import { Colors, Layout } from '@/constants/Colors';
import { useProviderChatInbox } from '@/hooks/useProviderChatInbox';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { MessageCircle, RefreshCw } from 'lucide-react-native';
import React from 'react';
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

function statusLabel(status: string): string {
    if (status === 'accepted') return 'Pedido confirmado';
    if (status === 'paid') return 'Pago no app';
    if (status === 'en_route') return 'A caminho';
    if (status === 'completed') return 'Concluído';
    return 'Em atendimento';
}

function formatRelative(dateString?: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Agora';
    if (diffMin < 60) return `${diffMin}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function ChatScreen() {
    const router = useRouter();
    const { threads, loading, error, refetch } = useProviderChatInbox();
    const featuredThread = threads[0];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Conversas</Text>
                    <Text style={styles.subtitle}>Atenda pelo chat oficial do app com segurança</Text>
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={() => refetch()}>
                    <RefreshCw size={18} color={Colors.light.text} />
                </TouchableOpacity>
            </View>

            {featuredThread ? (
                <TouchableOpacity
                    style={styles.featuredCard}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/chat/${featuredThread.requestId}`)}
                >
                    <View style={styles.featuredBadge}>
                        <Text style={styles.featuredBadgeText}>Atendimento em foco</Text>
                    </View>
                    <Text style={styles.featuredTitle}>{featuredThread.client.name}</Text>
                    <Text style={styles.featuredSub}>
                        {statusLabel(featuredThread.status)} • {featuredThread.category || 'Serviço geral'}
                    </Text>
                    <Text style={styles.featuredHint}>
                        Abra o chat e use o icebreaker para iniciar com contexto profissional.
                    </Text>
                </TouchableOpacity>
            ) : null}

            {error ? (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : null}

            {loading ? (
                <View style={styles.centerWrap}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                    <Text style={styles.loadingText}>Sincronizando conversas...</Text>
                </View>
            ) : (
                <FlatList
                    data={threads}
                    keyExtractor={(item) => item.requestId}
                    contentContainerStyle={[styles.listContent, threads.length === 0 && { flex: 1 }]}
                    refreshControl={
                        <RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.light.primary} />
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.chatRow}
                            onPress={() => router.push(`/chat/${item.requestId}`)}
                            activeOpacity={0.8}
                        >
                            {item.client.avatarUrl ? (
                                <ExpoImage source={{ uri: item.client.avatarUrl }} style={styles.avatar} contentFit="cover" />
                            ) : (
                                <View style={styles.avatarFallback}>
                                    <Text style={styles.avatarFallbackText}>{item.client.name.slice(0, 1).toUpperCase()}</Text>
                                </View>
                            )}

                            <View style={styles.chatInfo}>
                                <View style={styles.chatTopRow}>
                                    <View style={styles.clientNameRow}>
                                        <Text style={styles.clientName} numberOfLines={1}>{item.client.name}</Text>
                                        <Text style={styles.orderIdPill}>#{item.requestId.split('-')[0].toUpperCase()}</Text>
                                    </View>
                                    <Text style={styles.timestamp}>{formatRelative(item.lastMessageAt || item.updatedAt)}</Text>
                                </View>
                                <Text style={styles.chatStatus}>{statusLabel(item.status)}</Text>
                                <Text style={styles.lastMessage} numberOfLines={1}>
                                    {item.lastMessage || 'Toque para iniciar conversa com o cliente'}
                                </Text>
                            </View>

                            {item.unreadCount > 0 && (
                                <View style={styles.unreadPill}>
                                    <Text style={styles.unreadPillText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconWrap}>
                                <MessageCircle size={38} color={Colors.light.textMuted} />
                            </View>
                            <Text style={styles.emptyTitle}>Nenhuma conversa ativa</Text>
                            <Text style={styles.emptySubtitle}>
                                Assim que um serviço for confirmado com você, o chat aparecerá aqui automaticamente.
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
        backgroundColor: Colors.light.background,
    },
    header: {
        paddingHorizontal: Layout.spacing.lg,
        paddingVertical: Layout.spacing.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: Colors.light.text,
    },
    subtitle: {
        fontSize: 13,
        color: Colors.light.textMuted,
        marginTop: 2,
    },
    refreshBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    featuredCard: {
        marginHorizontal: Layout.spacing.md,
        marginBottom: Layout.spacing.sm,
        backgroundColor: Colors.light.headerDark,
        borderRadius: Layout.radius.lg,
        padding: Layout.spacing.md,
    },
    featuredBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderRadius: Layout.radius.round,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginBottom: 8,
    },
    featuredBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    featuredTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#fff',
    },
    featuredSub: {
        color: '#ffffffcc',
        fontSize: 13,
        marginTop: 2,
    },
    featuredHint: {
        color: '#ffffff99',
        fontSize: 12,
        marginTop: 8,
        lineHeight: 18,
    },
    listContent: {
        paddingHorizontal: Layout.spacing.md,
        paddingBottom: Layout.spacing.xl,
    },
    chatRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: Colors.light.border + '80',
        borderRadius: Layout.radius.md,
        padding: Layout.spacing.sm,
        marginBottom: Layout.spacing.sm,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    avatarFallback: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.primary + '20',
    },
    avatarFallbackText: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.light.primary,
    },
    chatInfo: {
        flex: 1,
        marginLeft: 12,
    },
    chatTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    clientNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    clientName: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.light.text,
    },
    orderIdPill: {
        fontSize: 10,
        fontWeight: '800',
        color: Colors.light.textMuted,
        backgroundColor: Colors.light.border + '40',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
        marginLeft: 6,
    },
    timestamp: {
        fontSize: 12,
        color: Colors.light.textMuted,
    },
    chatStatus: {
        marginTop: 2,
        fontSize: 12,
        fontWeight: '700',
        color: Colors.light.primary,
    },
    lastMessage: {
        marginTop: 2,
        fontSize: 13,
        color: Colors.light.textSecondary,
    },
    unreadPill: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: Colors.light.primary,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
        marginLeft: 8,
    },
    unreadPillText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    centerWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    loadingText: {
        fontSize: 14,
        color: Colors.light.textMuted,
    },
    errorBanner: {
        marginHorizontal: Layout.spacing.md,
        marginBottom: Layout.spacing.sm,
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
        borderWidth: 1,
        borderRadius: Layout.radius.sm,
        padding: Layout.spacing.sm,
    },
    errorText: {
        color: '#991B1B',
        fontSize: 13,
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Layout.spacing.xl,
    },
    emptyIconWrap: {
        width: 82,
        height: 82,
        borderRadius: 41,
        backgroundColor: Colors.light.border + '40',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Layout.spacing.md,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.light.text,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: Colors.light.textMuted,
        textAlign: 'center',
        lineHeight: 20,
    },
});
