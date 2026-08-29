import { Colors, Layout } from '@/constants/Colors';
import { ProviderServiceItem, useProviderServices } from '@/hooks/useProviderServices';
import { supabase } from '@/services/supabase';
import { Image as ExpoImage } from 'expo-image';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Briefcase, CalendarDays, CheckCircle2, Clock3, FileText, MapPin, MessageCircle, Navigation, Star, ThumbsUp } from 'lucide-react-native';
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

type ServiceFilter = 'in_progress' | 'done' | 'canceled';

function statusLabel(status: string): string {
    if (status === 'accepted') return 'Aceito';
    if (status === 'confirmed') return 'Confirmado';
    if (status === 'en_route') return 'A caminho';
    if (status === 'arrived') return 'No local';
    if (status === 'quote_provided') return 'Orçamento enviado';
    if (status === 'quote_accepted') return 'Em execução';
    if (status === 'done') return 'Concluído';
    if (status === 'canceled') return 'Cancelado';
    if (status === 'declined') return 'Recusado';
    if (status === 'expired') return 'Expirado';
    if (status === 'disputed') return 'Em disputa';
    return 'Em análise';
}

function statusColor(status: string): string {
    if (status === 'accepted' || status === 'confirmed') return '#0369A1';
    if (status === 'en_route') return Colors.light.primary;
    if (status === 'arrived' || status === 'quote_provided') return '#F59E0B'; // Amber
    if (status === 'quote_accepted') return '#059669'; // Emerald
    if (status === 'done') return Colors.light.success;
    if (status === 'canceled' || status === 'declined' || status === 'disputed') return Colors.light.danger;
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
    const in_progress = filter === 'in_progress';

    return (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
                {done ? (
                    <CheckCircle2 size={38} color={Colors.light.textMuted} />
                ) : (
                    <Briefcase size={38} color={Colors.light.textMuted} />
                )}
            </View>
            <Text style={styles.emptyTitle}>{in_progress ? 'Nenhum serviço em andamento' : done ? 'Nenhum serviço finalizado' : 'Nenhum serviço cancelado'}</Text>
            <Text style={styles.emptySubtitle}>
                {in_progress
                    ? 'Assim que um cliente confirmar sua oferta, o serviço aparecerá nesta lista.'
                    : 'Os serviços aparecerão de acordo com seus status nas abas correspondentes.'}
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
    onSetArrived,
    onOpenQuoteModal,
    onConfirmDone,
    onRate,
    actionLoading,
}: {
    item: ProviderServiceItem;
    onOpenChat: (requestId: string) => void;
    onSetEnRoute: (requestId: string) => void;
    onSetArrived: (requestId: string) => void;
    onOpenQuoteModal: (item: ProviderServiceItem) => void;
    onConfirmDone: (requestId: string) => void;
    onRate: (item: ProviderServiceItem) => void;
    actionLoading: string | null;
}) {
    const isLoading = actionLoading === item.id;
    const canGoEnRoute = item.status === 'confirmed';
    const canArrive = item.status === 'en_route';
    const canSubmitQuote = item.status === 'arrived';
    const waitingClientQuote = item.status === 'quote_provided';
    const canConfirmDone = item.status === 'quote_accepted' && !item.done_provider_at;
    const waitingClient = item.status === 'quote_accepted' && !!item.done_provider_at && !item.done_client_at;
    const isDone = item.status === 'done';

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

                {canArrive && (
                    <TouchableOpacity
                        style={styles.doneBtn}
                        onPress={() => onSetArrived(item.id)}
                        disabled={isLoading}
                        activeOpacity={0.85}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <MapPin size={15} color="#fff" />
                                <Text style={styles.doneBtnText}>Cheguei no local</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {canSubmitQuote && (
                    <TouchableOpacity
                        style={styles.enRouteBtn}
                        onPress={() => onOpenQuoteModal(item)}
                        disabled={isLoading}
                        activeOpacity={0.85}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <FileText size={15} color="#fff" />
                                <Text style={styles.enRouteBtnText}>Enviar Orçamento</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {waitingClientQuote && (
                    <View style={styles.waitingBanner}>
                        <Clock3 size={14} color="#D97706" />
                        <Text style={[styles.waitingBannerText, { color: '#B45309' }]}>Aguardando aprovação do orçamento pelo cliente.</Text>
                    </View>
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
    const { inProgress = [], done = [], canceled = [], loading, error, refetch } = useProviderServices();
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [ratingTarget, setRatingTarget] = useState<ProviderServiceItem | null>(null);

    const [quoteTarget, setQuoteTarget] = useState<ProviderServiceItem | null>(null);
    const [quoteValue, setQuoteValue] = useState('');

    const data = useMemo(() => {
        if (filter === 'in_progress') return inProgress;
        if (filter === 'done') return done;
        return canceled;
    }, [filter, inProgress, done, canceled]);

    // Battery Fix: Location broadcast only when en_route
    const hasEnRouteJob = inProgress.some(item => item.status === 'en_route');

    React.useEffect(() => {
        if (!hasEnRouteJob) return;

        const syncLocation = async () => {
            try {
                const currentPosition = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                await supabase.rpc('set_my_partner_location', {
                    input_lat: currentPosition.coords.latitude,
                    input_long: currentPosition.coords.longitude,
                });
            } catch (err) {
                console.warn('[active] Failed to sync en_route location:', err);
            }
        };

        syncLocation();
        const interval = setInterval(syncLocation, 30_000);
        return () => clearInterval(interval);
    }, [hasEnRouteJob]);

    const handleSetEnRoute = async (requestId: string) => {
        if (actionLoading) return;
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

    const handleSetArrived = async (requestId: string) => {
        if (actionLoading) return;
        setActionLoading(requestId);
        try {
            const { error: err } = await supabase.rpc('provider_set_arrived', { p_request_id: requestId });
            if (err) throw err;
            refetch();
        } catch (e: any) {
            Alert.alert('Erro', e?.message || 'Não foi possível marcar como cheguei.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleSubmitQuote = async () => {
        if (!quoteTarget || actionLoading) return;
        
        const price = Number.parseFloat(quoteValue.replace(',', '.'));
        if (!Number.isFinite(price) || price <= 0 || price > 50000) {
            Alert.alert('Erro', 'Por favor, informe um valor de orçamento válido (maior que zero).');
            return;
        }

        const targetId = quoteTarget.id;
        setActionLoading(targetId);
        setQuoteTarget(null);
        try {
            const { error: err } = await supabase.rpc('provider_submit_quote', {
                p_request_id: targetId,
                p_quote_price: price,
            });
            if (err) throw err;
            setQuoteValue('');
            refetch();
        } catch (e: any) {
            Alert.alert('Erro', e?.message || 'Não foi possível enviar o orçamento.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleConfirmDone = async (requestId: string) => {
        if (actionLoading) return;
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
                    {filter === 'in_progress' ? `${inProgress.length} em andamento` : filter === 'done' ? `${done.length} finalizados` : `${canceled.length} cancelados`}
                </Text>
            </View>

            <View style={styles.segmented}>
                <TouchableOpacity
                    style={[styles.segmentBtn, filter === 'in_progress' && styles.segmentBtnActive]}
                    onPress={() => setFilter('in_progress')}
                >
                    <Text style={[styles.segmentText, filter === 'in_progress' && styles.segmentTextActive]}>Andamento</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.segmentBtn, filter === 'done' && styles.segmentBtnActive]}
                    onPress={() => setFilter('done')}
                >
                    <Text style={[styles.segmentText, filter === 'done' && styles.segmentTextActive]}>Finalizados</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.segmentBtn, filter === 'canceled' && styles.segmentBtnActive]}
                    onPress={() => setFilter('canceled')}
                >
                    <Text style={[styles.segmentText, filter === 'canceled' && styles.segmentTextActive]}>Cancelados</Text>
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
                            onSetArrived={handleSetArrived}
                            onOpenQuoteModal={setQuoteTarget}
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

            <Modal visible={!!quoteTarget} transparent animationType="fade" onRequestClose={() => setQuoteTarget(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Orçamento Final</Text>
                        <Text style={styles.modalSubtitle}>Insira o valor do serviço e peças para aprovação do cliente.</Text>
                        
                        <TextInput
                            style={[styles.commentInput, { minHeight: 50, fontSize: 18, fontWeight: 'bold' }]}
                            placeholder="Valor R$"
                            placeholderTextColor="#9CA3AF"
                            value={quoteValue}
                            onChangeText={setQuoteValue}
                            keyboardType="decimal-pad"
                        />
                        
                        <TouchableOpacity
                            style={[styles.modalSubmitBtn, actionLoading === quoteTarget?.id && { opacity: 0.6 }]}
                            onPress={handleSubmitQuote}
                            disabled={actionLoading === quoteTarget?.id}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.modalSubmitText}>Enviar Orçamento</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setQuoteTarget(null)} style={styles.modalSkipBtn} activeOpacity={0.7}>
                            <Text style={styles.modalSkipText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
