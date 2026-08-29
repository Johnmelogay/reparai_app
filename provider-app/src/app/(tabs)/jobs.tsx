/**
 * Jobs Screen — Provider's main dashboard
 * Shows nearby open requests (status = 'finding').
 * This is the provider's "home page" after login.
 */
import { Colors, Layout } from '@/constants/Colors';
import { useOpenRequests } from '@/hooks/useOpenRequests';
import { useProviderProfile } from '@/hooks/useProviderProfile';
import { supabase } from '@/services/supabase';
import { OpenRequest } from '@/types';
import { categoryLabel } from '@/utils/category';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    AlertCircle,
    ChevronRight,
    Clock,
    MapPin,
    Wrench,
    X,
    Zap,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    AppState,
    AppStateStatus,
    FlatList,
    Keyboard,
    Modal,
    Pressable,
    RefreshControl,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type OfferDraft = {
    price: number;
    estimatedTime: number;
    message: string;
};

// ===== Category Display Helpers =====
const CATEGORY_LABELS: Record<string, string> = {
    mobilidade: 'Mobilidade',
    casa: 'Casa',
    tecnologia: 'Tecnologia',
};

const CATEGORY_COLORS: Record<string, string> = {
    mobilidade: '#3B82F6',
    casa: '#F59E0B',
    tecnologia: '#8B5CF6',
};

function getCategoryLabel(slug: string): string {
    return CATEGORY_LABELS[slug] || slug;
}

function getCategoryColor(slug: string): string {
    return CATEGORY_COLORS[slug] || Colors.light.primary;
}

function getTimeAgo(dateStr: string): string {
    const now = new Date();
    const created = new Date(dateStr);
    const diffMs = now.getTime() - created.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Agora';
    if (diffMin < 60) return `${diffMin}min atrás`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;
    return `${Math.floor(diffHours / 24)}d atrás`;
}

// ===== Job Card =====
function JobCard({
    request,
    onAccept,
    onReject,
    onOpenDetails,
    submittingAction,
}: {
    request: OpenRequest;
    onAccept: (request: OpenRequest) => void;
    onReject: (request: OpenRequest) => void;
    onOpenDetails: (request: OpenRequest) => void;
    submittingAction: 'accept' | 'reject' | null;
}) {
    const aiSummary = request.ai_result_json?.summary_for_provider;
    const problemGuess = request.ai_result_json?.problem_guess;
    const confidence = request.ai_result_json?.confidence;
    const categoryColor = getCategoryColor(request.category);
    const isUrgent = !!request.expires_at;

    const addressHint = [request.neighborhood, request.city]
        .filter(Boolean)
        .join(', ') || request.address || 'Localização não informada';

    return (
        <View style={styles.card}>
            <TouchableOpacity activeOpacity={0.85} onPress={() => onOpenDetails(request)}>
                {/* Header Row */}
                <View style={styles.cardHeader}>
                    <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '18' }]}>
                        <Text style={[styles.categoryBadgeText, { color: categoryColor }]}>
                            {getCategoryLabel(request.category)}
                        </Text>
                    </View>

                    <View style={styles.cardHeaderRight}>
                        {isUrgent && (
                            <View style={styles.urgentBadge}>
                                <Zap size={12} color="#fff" />
                                <Text style={styles.urgentText}>Urgente</Text>
                            </View>
                        )}
                        <Text style={styles.timeAgo}>{getTimeAgo(request.created_at)}</Text>
                    </View>
                </View>

                {/* Problem Summary */}
                <Text style={styles.problemGuess} numberOfLines={1}>
                    {problemGuess || request.user_text || 'Pedido de serviço'}
                </Text>

                {aiSummary && (
                    <Text style={styles.aiSummary} numberOfLines={2}>
                        {aiSummary}
                    </Text>
                )}

                {/* Issue Tags */}
                {request.issue_tags && request.issue_tags.length > 0 && (
                    <View style={styles.tagsRow}>
                        {request.issue_tags.slice(0, 3).map((tag, i) => (
                            <View key={i} style={styles.tag}>
                                <Text style={styles.tagText}>{tag}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Footer: Location + Confidence + CTA */}
                <View style={styles.cardFooter}>
                    <View style={styles.locationRow}>
                        <MapPin size={14} color={Colors.light.textMuted} />
                        <Text style={styles.locationText} numberOfLines={1}>
                            {addressHint}
                        </Text>
                    </View>

                    {request.dist_km != null && (
                        <View style={styles.distancePill}>
                            <Text style={styles.distancePillText}>{request.dist_km.toFixed(1)} km</Text>
                        </View>
                    )}

                    {confidence != null && (
                        <View style={styles.confidenceRow}>
                            <View style={[
                                styles.confidenceDot,
                                { backgroundColor: confidence > 0.7 ? Colors.light.success : confidence > 0.4 ? Colors.light.warning : Colors.light.danger },
                            ]} />
                            <Text style={styles.confidenceText}>
                                {Math.round(confidence * 100)}%
                            </Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.detailsLink} onPress={() => onOpenDetails(request)} activeOpacity={0.7}>
                <Text style={styles.detailsLinkText}>Ver detalhes completos</Text>
                <ChevronRight size={14} color={Colors.light.primary} />
            </TouchableOpacity>

            <View style={styles.actionsRow}>
                <TouchableOpacity
                    style={[styles.rejectBtn, submittingAction === 'reject' && styles.actionBtnDisabled]}
                    activeOpacity={0.8}
                    onPress={() => onReject(request)}
                    disabled={submittingAction !== null}
                >
                    {submittingAction === 'reject' ? (
                        <ActivityIndicator size="small" color={Colors.light.danger} />
                    ) : (
                        <>
                            <X size={14} color={Colors.light.danger} />
                            <Text style={styles.rejectBtnText}>Recusar</Text>
                        </>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.acceptBtn, submittingAction === 'accept' && styles.actionBtnDisabled]}
                    activeOpacity={0.8}
                    onPress={() => onAccept(request)}
                    disabled={submittingAction !== null}
                >
                    {submittingAction === 'accept' ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <>
                            <ChevronRight size={16} color="#fff" />
                            <Text style={styles.acceptBtnText}>Fazer Oferta</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

// ===== Empty State =====
function EmptyState() {
    return (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBg}>
                <Clock size={40} color={Colors.light.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Nenhum pedido disponível</Text>
            <Text style={styles.emptyDescription}>
                Fique online para receber pedidos de clientes na sua região. Novos pedidos aparecem em tempo real.
            </Text>
        </View>
    );
}

// ===== Main Screen =====
export default function JobsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ offerRequestId?: string | string[] }>();
    const { profile, toggleOnline } = useProviderProfile();
    const { requests, loading, error, refetch } = useOpenRequests();
    const [submittingRequestId, setSubmittingRequestId] = useState<string | null>(null);
    const [submittingAction, setSubmittingAction] = useState<'accept' | 'reject' | null>(null);
    const [offerModalVisible, setOfferModalVisible] = useState(false);
    const [selectedOfferRequest, setSelectedOfferRequest] = useState<OpenRequest | null>(null);
    const [offerPrice, setOfferPrice] = useState('');
    const [offerEta, setOfferEta] = useState('');
    const [offerMessage, setOfferMessage] = useState('');
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);
    const autoOpenOfferRef = useRef<string | null>(null);

    const isOnline = profile?.is_online ?? false;
    const getParamValue = (value?: string | string[]): string => (Array.isArray(value) ? value[0] || '' : value || '');
    const offerRequestIdParam = getParamValue(params.offerRequestId);

    const buildDefaultOffer = useCallback((request: OpenRequest): OfferDraft => {
        const fallbackPrice = profile?.base_fee ?? 50;
        const fallbackEta = profile?.type === 'FIXED' ? 60 : 30;
        const diagnosis = request.ai_result_json?.problem_guess || request.user_text || 'seu atendimento';
        return {
            price: fallbackPrice,
            estimatedTime: fallbackEta,
            message: `Posso ajudar com ${diagnosis}. Vamos alinhar os detalhes pelo chat oficial do app.`,
        };
    }, [profile?.base_fee, profile?.type]);

    const openOfferModal = useCallback((request: OpenRequest, draft?: OfferDraft) => {
        const defaultDraft = draft || buildDefaultOffer(request);
        setSelectedOfferRequest(request);
        setOfferPrice(String(defaultDraft.price));
        setOfferEta(String(defaultDraft.estimatedTime));
        setOfferMessage(defaultDraft.message);
        setOfferModalVisible(true);
    }, [buildDefaultOffer]);

    const syncProviderLocation = useCallback(async (options?: { requestPermission?: boolean; silent?: boolean }) => {
        const requestPermission = options?.requestPermission ?? false;
        const silent = options?.silent ?? true;

        try {
            let permission = await Location.getForegroundPermissionsAsync();
            if (permission.status !== 'granted' && requestPermission) {
                permission = await Location.requestForegroundPermissionsAsync();
            }

            if (permission.status !== 'granted') {
                if (!silent) {
                    Alert.alert(
                        'Permissão de localização necessária',
                        'Ative a localização para receber pedidos próximos.'
                    );
                }
                return false;
            }

            const currentPosition = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const { error: locationError } = await supabase.rpc('set_my_partner_location', {
                input_lat: currentPosition.coords.latitude,
                input_long: currentPosition.coords.longitude,
            });

            if (locationError) throw locationError;
            return true;
        } catch (locationErr) {
            console.warn('[jobs] Failed to sync provider location:', locationErr);
            if (!silent) {
                Alert.alert(
                    'Não foi possível atualizar localização',
                    'Verifique GPS/permissões e tente novamente.'
                );
            }
            return false;
        }
    }, []);

    const handleToggleOnline = useCallback(async (value: boolean) => {
        if (value) {
            const missing: string[] = [];
            if (!profile?.full_name?.trim()) missing.push('nome');
            if (!profile?.service_category) missing.push('categoria');

            // Always refresh geolocation when going online to avoid stale dispatch radius.
            const syncedNow = await syncProviderLocation({ requestPermission: true, silent: false });
            const hasLocation = syncedNow || !!profile?.location;

            if (!hasLocation) missing.push('localização');

            if (missing.length > 0) {
                Alert.alert(
                    'Complete o perfil para ficar online',
                    `Faltando: ${missing.join(', ')}.`,
                    [
                        { text: 'Agora não', style: 'cancel' },
                        {
                            text: 'Completar Perfil',
                            onPress: () => router.push('/profile/edit'),
                        },
                    ]
                );
                return;
            }
        }

        const { error } = await toggleOnline(value);
        if (error) {
            Alert.alert(
                'Erro ao atualizar status',
                error instanceof Error ? error.message : 'Não foi possível atualizar seu status online.'
            );
        }
    }, [profile?.full_name, profile?.location, profile?.service_category, router, syncProviderLocation, toggleOnline]);

    useEffect(() => {
        if (!isOnline) return;

        // Sync immediately when going online.
        syncProviderLocation({ requestPermission: false, silent: true });

        const subscription = AppState.addEventListener('change', (nextState) => {
            const wasBackground = appStateRef.current.match(/inactive|background/);
            appStateRef.current = nextState;
            if (wasBackground && nextState === 'active') {
                syncProviderLocation({ requestPermission: false, silent: true });
            }
        });

        return () => {
            subscription.remove();
        };
    }, [isOnline, syncProviderLocation]);

    useEffect(() => {
        if (!isOnline || !offerRequestIdParam) return;
        if (autoOpenOfferRef.current === offerRequestIdParam) return;

        const matched = requests.find((item) => item.id === offerRequestIdParam);
        if (!matched) {
            if (!loading) {
                autoOpenOfferRef.current = offerRequestIdParam;
                Alert.alert('Pedido indisponível', 'Este pedido não está mais elegível para oferta.');
            }
            return;
        }

        autoOpenOfferRef.current = offerRequestIdParam;
        openOfferModal(matched);
    }, [isOnline, loading, offerRequestIdParam, openOfferModal, requests]);

    const handleAcceptRequest = useCallback(async (request: OpenRequest, draft: OfferDraft): Promise<boolean> => {
        try {
            setSubmittingRequestId(request.id);
            setSubmittingAction('accept');

            const { error } = await supabase.rpc('submit_provider_offer', {
                p_request_id: request.id,
                p_price: draft.price,
                p_estimated_time: draft.estimatedTime,
                p_message: draft.message,
            });

            if (error) throw error;

            Alert.alert('Oferta enviada', 'Sua proposta foi enviada ao cliente em tempo real.');
            await refetch();
            return true;
        } catch (error: any) {
            Alert.alert('Erro ao enviar oferta', error?.message || 'Não foi possível enviar sua proposta.');
            return false;
        } finally {
            setSubmittingRequestId(null);
            setSubmittingAction(null);
        }
    }, [refetch]);

    const handleRejectRequest = useCallback(async (request: OpenRequest) => {
        try {
            setSubmittingRequestId(request.id);
            setSubmittingAction('reject');

            const { error } = await supabase.rpc('reject_provider_offer', {
                p_request_id: request.id,
            });

            if (error) throw error;
            await refetch();
        } catch (error: any) {
            Alert.alert('Erro ao recusar pedido', error?.message || 'Não foi possível recusar este pedido.');
        } finally {
            setSubmittingRequestId(null);
            setSubmittingAction(null);
        }
    }, [refetch]);

    const handleSubmitOfferFromModal = useCallback(async () => {
        if (!selectedOfferRequest) return;

        const normalizedPrice = Number.parseFloat(offerPrice.replace(',', '.'));
        const normalizedEta = Number.parseInt(offerEta, 10);
        const normalizedMessage = offerMessage.trim();

        if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
            Alert.alert('Valor inválido', 'Informe um valor de deslocamento maior que zero.');
            return;
        }

        if (!Number.isFinite(normalizedEta) || normalizedEta < 5 || normalizedEta > 240) {
            Alert.alert('Tempo inválido', 'Informe um tempo estimado entre 5 e 240 minutos.');
            return;
        }

        if (!normalizedMessage) {
            Alert.alert('Mensagem obrigatória', 'Escreva uma mensagem curta para o cliente.');
            return;
        }

        const sent = await handleAcceptRequest(selectedOfferRequest, {
            price: normalizedPrice,
            estimatedTime: normalizedEta,
            message: normalizedMessage,
        });

        if (sent) {
            setOfferModalVisible(false);
            setSelectedOfferRequest(null);
        }
    }, [handleAcceptRequest, offerEta, offerMessage, offerPrice, selectedOfferRequest]);

    const handleOpenDetails = useCallback((request: OpenRequest) => {
        router.push({
            pathname: '/jobDetail',
            params: { requestId: request.id },
        } as any);
    }, [router]);

    const renderItem = useCallback(({ item }: { item: OpenRequest }) => (
        <JobCard
            request={item}
            onAccept={openOfferModal}
            onReject={handleRejectRequest}
            onOpenDetails={handleOpenDetails}
            submittingAction={submittingRequestId === item.id ? submittingAction : null}
        />
    ), [handleOpenDetails, handleRejectRequest, openOfferModal, submittingAction, submittingRequestId]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Top Header */}
            <LinearGradient
                colors={['#1A1A2E', '#16213E']}
                style={[styles.headerGradient]}
            >
                <View style={styles.headerContent}>
                    <View>
                        <Text style={styles.greeting}>
                            Olá, {profile?.full_name?.split(' ')[0] || 'Prestador'}
                        </Text>
                        <Text style={styles.headerSubtitle}>
                            {isOnline
                                ? `${requests.length} pedido${requests.length !== 1 ? 's' : ''} disponíve${requests.length !== 1 ? 'is' : 'l'}`
                                : 'Você está offline'}
                        </Text>
                    </View>

                    {/* Online Toggle */}
                    <View style={styles.onlineToggle}>
                        <Text style={[
                            styles.onlineLabel,
                            { color: isOnline ? Colors.light.online : '#ffffff80' }
                        ]}>
                            {isOnline ? 'Online' : 'Offline'}
                        </Text>
                        <Switch
                            value={isOnline}
                            onValueChange={handleToggleOnline}
                            trackColor={{
                                false: '#ffffff30',
                                true: Colors.light.online + '60',
                            }}
                            thumbColor={isOnline ? Colors.light.online : '#ccc'}
                        />
                    </View>
                </View>

                {/* Stats Bar */}
                {isOnline && (
                    <View style={styles.statsBar}>
                        <View style={styles.statItem}>
                            <Wrench size={14} color="#ffffff80" />
                            <Text style={styles.statValue}>{categoryLabel(profile?.service_category)}</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Avaliação</Text>
                            <Text style={styles.statValue}>
                                {profile?.rating ? `${profile.rating.toFixed(1)} ★` : '—'}
                            </Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Tipo</Text>
                            <Text style={styles.statValue}>
                                {profile?.type === 'FIXED' ? 'Oficina' : 'Móvel'}
                            </Text>
                        </View>
                    </View>
                )}
            </LinearGradient>

            {/* Offline Banner */}
            {!isOnline && (
                <View style={styles.offlineBanner}>
                    <AlertCircle size={16} color={Colors.light.warning} />
                    <Text style={styles.offlineBannerText}>
                        Ative o modo online para ver e receber pedidos.
                    </Text>
                </View>
            )}

            {error ? (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : null}

            {/* Requests List */}
            <FlatList
                data={isOnline ? requests : []}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={[
                    styles.listContent,
                    (!isOnline || requests.length === 0) && styles.listContentEmpty,
                ]}
                ListEmptyComponent={isOnline ? (loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={Colors.light.primary} />
                        <Text style={styles.loadingText}>Buscando pedidos...</Text>
                    </View>
                ) : <EmptyState />) : null}
                refreshControl={
                    <RefreshControl
                        refreshing={false}
                        onRefresh={refetch}
                        tintColor={Colors.light.primary}
                    />
                }
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            />

            <Modal
                visible={offerModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => {
                    setOfferModalVisible(false);
                    setSelectedOfferRequest(null);
                }}
            >
                <Pressable
                    style={styles.modalBackdrop}
                    onPress={Keyboard.dismiss}
                >
                    <Pressable
                        style={styles.modalCard}
                        onPress={(e) => e.stopPropagation()} // Prevent dismissing when clicking the card itself
                    >
                        <Text style={styles.modalTitle}>Fazer oferta</Text>
                        <Text style={styles.modalSubtitle} numberOfLines={2}>
                            {selectedOfferRequest?.ai_result_json?.problem_guess || selectedOfferRequest?.user_text || 'Atendimento solicitado'}
                        </Text>

                        <View style={styles.modalField}>
                            <Text style={styles.modalLabel}>Taxa de deslocamento (R$)</Text>
                            <TextInput
                                value={offerPrice}
                                onChangeText={setOfferPrice}
                                keyboardType="decimal-pad"
                                style={styles.modalInput}
                                placeholder="Ex: 60"
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>

                        <View style={styles.modalField}>
                            <Text style={styles.modalLabel}>Tempo estimado (min)</Text>
                            <TextInput
                                value={offerEta}
                                onChangeText={setOfferEta}
                                keyboardType="number-pad"
                                style={styles.modalInput}
                                placeholder="Ex: 30"
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>

                        <View style={styles.modalField}>
                            <Text style={styles.modalLabel}>Mensagem para o cliente</Text>
                            <TextInput
                                value={offerMessage}
                                onChangeText={setOfferMessage}
                                style={[styles.modalInput, styles.modalInputMultiline]}
                                multiline
                                maxLength={280}
                                placeholder="Explique como você pode ajudar e convide para continuar no chat."
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => {
                                    setOfferModalVisible(false);
                                    setSelectedOfferRequest(null);
                                }}
                                disabled={submittingAction === 'accept'}
                            >
                                <Text style={styles.modalCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalSubmitBtn, submittingAction === 'accept' && styles.actionBtnDisabled]}
                                onPress={handleSubmitOfferFromModal}
                                disabled={submittingAction === 'accept'}
                            >
                                {submittingAction === 'accept' ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.modalSubmitText}>Enviar oferta</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

// ===== Styles =====
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    headerGradient: {
        paddingHorizontal: Layout.spacing.lg,
        paddingTop: Layout.spacing.md,
        paddingBottom: Layout.spacing.lg,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    greeting: {
        fontSize: 22,
        fontWeight: '800',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#ffffff80',
        marginTop: 2,
    },
    onlineToggle: {
        alignItems: 'center',
        gap: 4,
    },
    onlineLabel: {
        fontSize: 12,
        fontWeight: '700',
    },
    statsBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Layout.spacing.md,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: Layout.radius.md,
        paddingVertical: Layout.spacing.sm,
        paddingHorizontal: Layout.spacing.md,
    },
    statItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    statDivider: {
        width: 1,
        height: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    statLabel: {
        fontSize: 11,
        color: '#ffffff60',
    },
    statValue: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffffcc',
    },
    offlineBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.light.warningBackground,
        paddingVertical: Layout.spacing.sm,
        paddingHorizontal: Layout.spacing.md,
        marginHorizontal: Layout.spacing.md,
        marginTop: Layout.spacing.sm,
        borderRadius: Layout.radius.sm,
    },
    offlineBannerText: {
        fontSize: 13,
        color: '#92400E',
        flex: 1,
    },
    errorBanner: {
        marginHorizontal: Layout.spacing.md,
        marginTop: Layout.spacing.sm,
        marginBottom: 2,
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
        borderWidth: 1,
        borderRadius: Layout.radius.sm,
        paddingHorizontal: Layout.spacing.sm,
        paddingVertical: 10,
    },
    errorText: {
        color: '#991B1B',
        fontSize: 13,
        fontWeight: '600',
    },
    listContent: {
        padding: Layout.spacing.md,
        gap: Layout.spacing.md,
    },
    listContentEmpty: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 80,
        gap: Layout.spacing.md,
    },
    loadingText: {
        fontSize: 14,
        color: Colors.light.textMuted,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Layout.spacing.xl,
        paddingVertical: 80,
    },
    emptyIconBg: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.light.border + '40',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Layout.spacing.md,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.light.text,
        marginBottom: Layout.spacing.sm,
    },
    emptyDescription: {
        fontSize: 14,
        color: Colors.light.textMuted,
        textAlign: 'center',
        lineHeight: 20,
    },
    // ===== Job Card =====
    card: {
        backgroundColor: Colors.light.card,
        borderRadius: Layout.radius.lg,
        padding: Layout.spacing.md,
        ...Layout.shadows.small,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Layout.spacing.sm,
    },
    cardHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    categoryBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: Layout.radius.round,
    },
    categoryBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    urgentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: Colors.light.danger,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: Layout.radius.round,
    },
    urgentText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
    },
    timeAgo: {
        fontSize: 12,
        color: Colors.light.textMuted,
    },
    problemGuess: {
        fontSize: 17,
        fontWeight: '700',
        color: Colors.light.text,
        marginBottom: 4,
    },
    aiSummary: {
        fontSize: 14,
        color: Colors.light.textSecondary,
        lineHeight: 20,
        marginBottom: Layout.spacing.sm,
    },
    tagsRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: Layout.spacing.sm,
    },
    tag: {
        backgroundColor: Colors.light.background,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: Layout.radius.round,
    },
    tagText: {
        fontSize: 12,
        color: Colors.light.textSecondary,
        fontWeight: '500',
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: Colors.light.border + '60',
        paddingTop: Layout.spacing.sm,
        gap: Layout.spacing.sm,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 4,
    },
    locationText: {
        fontSize: 13,
        color: Colors.light.textMuted,
        flex: 1,
    },
    confidenceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    distancePill: {
        backgroundColor: Colors.light.background,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: Layout.radius.round,
    },
    distancePillText: {
        fontSize: 12,
        color: Colors.light.textSecondary,
        fontWeight: '600',
    },
    confidenceDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    confidenceText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.light.textSecondary,
    },
    detailsLink: {
        marginTop: 8,
        marginBottom: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 2,
    },
    detailsLinkText: {
        fontSize: 12,
        color: Colors.light.primary,
        fontWeight: '700',
    },
    actionsRow: {
        flexDirection: 'row',
        marginTop: Layout.spacing.sm,
        gap: Layout.spacing.sm,
    },
    rejectBtn: {
        flex: 1,
        height: 42,
        borderRadius: Layout.radius.md,
        borderWidth: 1,
        borderColor: Colors.light.danger + '44',
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    rejectBtnText: {
        color: Colors.light.danger,
        fontWeight: '700',
        fontSize: 13,
    },
    acceptBtn: {
        flex: 1.5,
        height: 42,
        borderRadius: Layout.radius.md,
        backgroundColor: Colors.light.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    acceptBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 13,
    },
    actionBtnDisabled: {
        opacity: 0.7,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: Layout.spacing.md,
        paddingTop: Layout.spacing.md,
        paddingBottom: Layout.spacing.lg,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.light.text,
    },
    modalSubtitle: {
        marginTop: 4,
        marginBottom: 12,
        fontSize: 13,
        color: Colors.light.textMuted,
        lineHeight: 18,
    },
    modalField: {
        marginTop: 8,
    },
    modalLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.light.textSecondary,
        marginBottom: 6,
    },
    modalInput: {
        height: 44,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.light.border,
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        color: Colors.light.text,
        fontSize: 14,
    },
    modalInputMultiline: {
        height: 94,
        textAlignVertical: 'top',
        paddingTop: 10,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
    },
    modalCancelBtn: {
        flex: 1,
        height: 44,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.light.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCancelText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.light.textSecondary,
    },
    modalSubmitBtn: {
        flex: 1.4,
        height: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.primary,
    },
    modalSubmitText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#fff',
    },
});
