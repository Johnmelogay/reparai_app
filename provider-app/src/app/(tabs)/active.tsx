import { Colors, Layout } from '@/constants/Colors';
import { ProviderServiceItem, useProviderServices } from '@/hooks/useProviderServices';
import { supabase } from '@/services/supabase';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { Briefcase, CalendarDays, CheckCircle2, Clock3, MapPin, MessageCircle, Navigation, Star, ThumbsUp } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ServiceFilter = 'in_progress' | 'done';

function statusLabel(status: string): string {
    if (status === 'accepted') return 'Confirmado';
    if (status === 'paid') return 'Pago';
    if (status === 'en_route') return 'A caminho';
    if (status === 'done') return 'Concluído';
    if (status === 'completed') return 'Concluído';
    if (status === 'canceled') return 'Cancelado';
    return 'Em análise';
}

function statusColor(status: string): string {
    if (status === 'accepted' || status === 'paid') return '#0369A1';
    if (status === 'en_route') return Colors.light.primary;
    if (status === 'done' || status === 'completed') return Colors.light.success;
    if (status === 'canceled') return Colors.light.danger;
    return Colors.light.textMuted;
}

function formatWhen(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Agora';
    if (diffMin < 60) return `${diffMin} min`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)} h`;
    return `${Math.floor(diffMin / 1440)} d`;
}

function EmptyState({ filter }: { filter: ServiceFilter }) {
    const done = filter === 'done';

    return (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
                {done ? (
                    <CheckCircle2 size={38} color={Colors.light.textMuted} />
                ) : (
                    <Briefcase size={38} color={Colors.light.textMuted} />
                )}
            </View>
            <Text style={styles.emptyTitle}>{done ? 'Nenhum serviço finalizado' : 'Nenhum serviço em andamento'}</Text>
            <Text style={styles.emptySubtitle}>
                {done
                    ? 'Quando um atendimento for concluído, ele aparecerá aqui.'
                    : 'Assim que um cliente confirmar sua oferta, o serviço aparecerá nesta lista.'}
            </Text>
        </View>
    );
}

function RatingModal({
    visible,
    clientName,
    onSubmit,
    onClose,
}: {
    visible: boolean;
    clientName: string;
    onSubmit: (rating: number, comment: string) => void;
    onClose: () => void;
}) {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        setSubmitting(true);
        await onSubmit(rating, comment);
        setSubmitting(false);
        setComment('');
        setRating(5);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                    <Text style={styles.modalTitle}>Avaliar cliente</Text>
                    <Text style={styles.modalSubtitle}>Como foi a experiência com {clientName}?</Text>

                    <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map((n) => (
                            <TouchableOpacity key={n} onPress={() => setRating(n)} activeOpacity={0.7}>
                                <Star
                                    size={36}
                                    color="#F59E0B"
                                    fill={n <= rating ? '#F59E0B' : 'transparent'}
                                />
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TextInput
                        style={styles.commentInput}
                        placeholder="Comentário (opcional)"
                        placeholderTextColor="#9CA3AF"
                        value={comment}
                        onChangeText={setComment}
                        multiline
                        maxLength={300}
                    />

                    <TouchableOpacity
                        style={[styles.modalSubmitBtn, submitting && { opacity: 0.6 }]}
                        onPress={handleSubmit}
                        disabled={submitting}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.modalSubmitText}>{submitting ? 'Enviando...' : 'Enviar avaliação'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={onClose} style={styles.modalSkipBtn} activeOpacity={0.7}>
                        <Text style={styles.modalSkipText}>Pular</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

function ServiceCard({
    item,
    onOpenChat,
    onSetEnRoute,
    onConfirmDone,
    onRate,
    actionLoading,
}: {
    item: ProviderServiceItem;
    onOpenChat: (requestId: string) => void;
    onSetEnRoute: (requestId: string) => void;
    onConfirmDone: (requestId: string) => void;
    onRate: (item: ProviderServiceItem) => void;
    actionLoading: string | null;
}) {
    const isLoading = actionLoading === item.id;
    const canGoEnRoute = item.status === 'paid';
    const canConfirmDone = item.status === 'en_route' && !item.done_provider_at;
    const waitingClient = item.status === 'en_route' && !!item.done_provider_at && !item.done_client_at;
    const isDone = item.status === 'done' || item.status === 'completed';

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '18' }]}>
                    <Text style={[styles.statusBadgeText, { color: statusColor(item.status) }]}>
                        {statusLabel(item.status)}
                    </Text>
                </View>
                <Text style={styles.timeAgo}>{formatWhen(item.updated_at)}</Text>
            </View>

            <View style={styles.clientRow}>
                {item.client_avatar ? (
                    <ExpoImage source={{ uri: item.client_avatar }} style={styles.clientAvatar} contentFit="cover" />
                ) : (
                    <View style={styles.clientAvatarFallback}>
                        <Text style={styles.clientAvatarFallbackText}>
                            {(item.client_name || 'C').slice(0, 1).toUpperCase()}
                        </Text>
                    </View>
                )}
                <View style={{ flex: 1 }}>
                    <Text style={styles.clientName}>{item.client_name || 'Cliente'}</Text>
                    <Text style={styles.serviceCategory}>{item.category || 'Serviço geral'}</Text>
                </View>
            </View>

            <Text style={styles.description} numberOfLines={2}>
                {item.user_text || 'Solicitação sem descrição detalhada.'}
            </Text>

            <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                    <MapPin size={13} color={Colors.light.textMuted} />
                    <Text style={styles.metaText} numberOfLines={1}>{item.address || 'Endereço não informado'}</Text>
                </View>
            </View>

            <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                    <CalendarDays size={13} color={Colors.light.textMuted} />
                    <Text style={styles.metaText}>Criado: {new Date(item.created_at).toLocaleDateString('pt-BR')}</Text>
                </View>
                <View style={styles.metaItem}>
                    <Clock3 size={13} color={Colors.light.textMuted} />
                    <Text style={styles.metaText}>Atualizado: {formatWhen(item.updated_at)}</Text>
                </View>
            </View>

            {/* Status-specific confirmation banner */}
            {waitingClient && (
                <View style={styles.waitingBanner}>
                    <ThumbsUp size={14} color="#16A34A" />
                    <Text style={styles.waitingBannerText}>Você confirmou. Aguardando confirmação do cliente.</Text>
                </View>
            )}

            {/* Action buttons */}
            <View style={styles.cardActions}>
                {canGoEnRoute && (
                    <TouchableOpacity
                        style={styles.enRouteBtn}
                        onPress={() => onSetEnRoute(item.id)}
                        disabled={isLoading}
                        activeOpacity={0.85}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Navigation size={15} color="#fff" />
                                <Text style={styles.enRouteBtnText}>Estou a caminho</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {canConfirmDone && (
                    <TouchableOpacity
                        style={styles.doneBtn}
                        onPress={() => onConfirmDone(item.id)}
                        disabled={isLoading}
                        activeOpacity={0.85}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <CheckCircle2 size={15} color="#fff" />
                                <Text style={styles.doneBtnText}>Finalizar serviço</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {isDone && (
                    <TouchableOpacity
                        style={styles.rateBtn}
                        onPress={() => onRate(item)}
                        activeOpacity={0.85}
                    >
                        <Star size={15} color={Colors.light.primary} />
                        <Text style={styles.rateBtnText}>Avaliar cliente</Text>
                    </TouchableOpacity>
                )}

                {!isDone && (
                    <TouchableOpacity style={styles.chatBtn} onPress={() => onOpenChat(item.id)} activeOpacity={0.85}>
                        <MessageCircle size={15} color="#fff" />
                        <Text style={styles.chatBtnText}>Abrir Chat</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

export default function ServicesScreen() {
    const router = useRouter();
    const [filter, setFilter] = useState<ServiceFilter>('in_progress');
    const { inProgress, done, loading, error, refetch } = useProviderServices();
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [ratingTarget, setRatingTarget] = useState<ProviderServiceItem | null>(null);

    const data = useMemo(() => (filter === 'in_progress' ? inProgress : done), [done, filter, inProgress]);

    const handleSetEnRoute = async (requestId: string) => {
        setActionLoading(requestId);
        try {
            const { error: err } = await supabase.rpc('provider_set_en_route', { p_request_id: requestId });
            if (err) throw err;
            refetch();
        } catch (e: any) {
            Alert.alert('Erro', e?.message || 'Não foi possível atualizar o status.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleConfirmDone = async (requestId: string) => {
        Alert.alert(
            'Finalizar serviço',
            'Confirma que o serviço foi concluído? O cliente também precisará confirmar.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Confirmar',
                    onPress: async () => {
                        setActionLoading(requestId);
                        try {
                            const { error: err } = await supabase.rpc('provider_confirm_done', { p_request_id: requestId });
                            if (err) throw err;
                            refetch();
                        } catch (e: any) {
                            Alert.alert('Erro', e?.message || 'Não foi possível finalizar.');
                        } finally {
                            setActionLoading(null);
                        }
                    },
                },
            ]
        );
    };

    const handleSubmitRating = async (rating: number, comment: string) => {
        if (!ratingTarget) return;
        try {
            const { error: err } = await supabase.rpc('submit_review', {
                p_request_id: ratingTarget.id,
                p_reviewee_id: ratingTarget.user_id,
                p_role: 'provider',
                p_rating: rating,
                p_comment: comment || null,
            });
            if (err) throw err;
            Alert.alert('Obrigado!', 'Sua avaliação foi enviada.');
        } catch (e: any) {
            Alert.alert('Erro', e?.message || 'Não foi possível enviar avaliação.');
        } finally {
            setRatingTarget(null);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>Serviços</Text>
                <Text style={styles.subtitle}>
                    {filter === 'in_progress' ? `${inProgress.length} em andamento` : `${done.length} finalizados`}
                </Text>
            </View>

            <View style={styles.segmented}>
                <TouchableOpacity
                    style={[styles.segmentBtn, filter === 'in_progress' && styles.segmentBtnActive]}
                    onPress={() => setFilter('in_progress')}
                >
                    <Text style={[styles.segmentText, filter === 'in_progress' && styles.segmentTextActive]}>Em andamento</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.segmentBtn, filter === 'done' && styles.segmentBtnActive]}
                    onPress={() => setFilter('done')}
                >
                    <Text style={[styles.segmentText, filter === 'done' && styles.segmentTextActive]}>Feitos</Text>
                </TouchableOpacity>
            </View>

            {error ? (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : null}

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                    <Text style={styles.loadingText}>Carregando serviços...</Text>
                </View>
            ) : (
                <FlatList
                    data={data}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <ServiceCard
                            item={item}
                            onOpenChat={(requestId) => router.push(`/chat/${requestId}`)}
                            onSetEnRoute={handleSetEnRoute}
                            onConfirmDone={handleConfirmDone}
                            onRate={setRatingTarget}
                            actionLoading={actionLoading}
                        />
                    )}
                    contentContainerStyle={[styles.listContent, data.length === 0 && { flex: 1 }]}
                    ListEmptyComponent={<EmptyState filter={filter} />}
                    refreshControl={
                        <RefreshControl
                            refreshing={false}
                            onRefresh={refetch}
                            tintColor={Colors.light.primary}
                        />
                    }
                />
            )}

            <RatingModal
                visible={!!ratingTarget}
                clientName={ratingTarget?.client_name || 'Cliente'}
                onSubmit={handleSubmitRating}
                onClose={() => setRatingTarget(null)}
            />
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
        paddingTop: Layout.spacing.md,
        paddingBottom: Layout.spacing.sm,
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
    segmented: {
        flexDirection: 'row',
        marginHorizontal: Layout.spacing.md,
        marginVertical: Layout.spacing.sm,
        borderRadius: Layout.radius.md,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: Colors.light.border,
        padding: 4,
    },
    segmentBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: 38,
        borderRadius: Layout.radius.sm,
    },
    segmentBtnActive: {
        backgroundColor: Colors.light.primary,
    },
    segmentText: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.light.textSecondary,
    },
    segmentTextActive: {
        color: '#fff',
    },
    listContent: {
        paddingHorizontal: Layout.spacing.md,
        paddingBottom: Layout.spacing.xl,
        gap: Layout.spacing.md,
    },
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    loadingText: {
        color: Colors.light.textMuted,
        fontSize: 14,
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
    card: {
        backgroundColor: '#fff',
        borderRadius: Layout.radius.lg,
        borderWidth: 1,
        borderColor: Colors.light.border + '80',
        padding: Layout.spacing.md,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Layout.spacing.sm,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: Layout.radius.round,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    timeAgo: {
        fontSize: 12,
        color: Colors.light.textMuted,
    },
    clientRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 10,
    },
    clientAvatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
    },
    clientAvatarFallback: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.primary + '20',
    },
    clientAvatarFallbackText: {
        color: Colors.light.primary,
        fontWeight: '800',
        fontSize: 17,
    },
    clientName: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.light.text,
    },
    serviceCategory: {
        fontSize: 12,
        color: Colors.light.textMuted,
        marginTop: 1,
    },
    description: {
        fontSize: 13,
        color: Colors.light.textSecondary,
        lineHeight: 19,
        marginBottom: Layout.spacing.sm,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 6,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flex: 1,
    },
    metaText: {
        fontSize: 12,
        color: Colors.light.textMuted,
        flex: 1,
    },
    cardActions: {
        marginTop: 10,
        gap: 8,
    },
    enRouteBtn: {
        height: 44,
        borderRadius: Layout.radius.md,
        backgroundColor: Colors.light.primary,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    enRouteBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    doneBtn: {
        height: 44,
        borderRadius: Layout.radius.md,
        backgroundColor: Colors.light.success,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    doneBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    rateBtn: {
        height: 44,
        borderRadius: Layout.radius.md,
        backgroundColor: Colors.light.primary + '14',
        borderWidth: 1,
        borderColor: Colors.light.primary + '30',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    rateBtnText: {
        color: Colors.light.primary,
        fontWeight: '700',
        fontSize: 14,
    },
    chatBtn: {
        height: 40,
        borderRadius: Layout.radius.md,
        backgroundColor: Colors.light.accent,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    chatBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 13,
    },
    waitingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#F0FDF4',
        borderRadius: Layout.radius.sm,
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    waitingBannerText: {
        flex: 1,
        fontSize: 12,
        fontWeight: '600',
        color: '#166534',
        lineHeight: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    modalCard: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 6,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 20,
    },
    starsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    commentInput: {
        width: '100%',
        minHeight: 80,
        borderRadius: 14,
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: '#111827',
        textAlignVertical: 'top',
        marginBottom: 18,
    },
    modalSubmitBtn: {
        width: '100%',
        height: 48,
        borderRadius: 14,
        backgroundColor: Colors.light.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    modalSubmitText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
    modalSkipBtn: {
        paddingVertical: 8,
    },
    modalSkipText: {
        color: '#9CA3AF',
        fontSize: 14,
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
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        color: Colors.light.textMuted,
        textAlign: 'center',
        lineHeight: 20,
    },
});
