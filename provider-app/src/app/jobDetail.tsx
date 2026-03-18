import { Colors, Layout } from '@/constants/Colors';
import { supabase } from '@/services/supabase';
import { OpenRequest } from '@/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Clock3, MapPin, ShieldCheck, Sparkles } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatDateTime(value?: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function statusLabel(status?: string): string {
    if (status === 'finding') return 'Buscando ofertas';
    if (status === 'offered') return 'Com ofertas em andamento';
    return 'Indisponível';
}

export default function JobDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ requestId?: string | string[] }>();
    const requestId = Array.isArray(params.requestId) ? params.requestId[0] : params.requestId;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [request, setRequest] = useState<OpenRequest | null>(null);

    const loadRequest = useCallback(async () => {
        if (!requestId) {
            setError('Pedido inválido.');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        const { data, error: rpcError } = await supabase.rpc('get_provider_open_requests', {
            input_radius_km: 15,
            input_limit: 100,
        });

        if (rpcError) {
            setError(rpcError.message || 'Não foi possível carregar os detalhes do pedido.');
            setLoading(false);
            return;
        }

        const match = ((data || []) as OpenRequest[]).find((item) => item.id === requestId) || null;
        if (!match) {
            setError('Este pedido não está mais disponível para sua operação.');
            setLoading(false);
            return;
        }

        setRequest(match);
        setLoading(false);
    }, [requestId]);

    useEffect(() => {
        loadRequest();
    }, [loadRequest]);

    const canOffer = useMemo(() => (
        !!request && (request.status === 'finding' || request.status === 'offered')
    ), [request]);

    const handleReject = useCallback(async () => {
        if (!request) return;
        const { error: rejectError } = await supabase.rpc('reject_provider_offer', {
            p_request_id: request.id,
        });

        if (rejectError) {
            Alert.alert('Erro ao recusar', rejectError.message || 'Não foi possível recusar este pedido.');
            return;
        }

        Alert.alert('Pedido recusado', 'Você não receberá novas ações para este ticket.');
        router.replace('/(tabs)/jobs');
    }, [request, router]);

    const handleOffer = useCallback(() => {
        if (!request) return;
        router.push({
            pathname: '/(tabs)/jobs',
            params: { offerRequestId: request.id },
        } as any);
    }, [request, router]);

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerWrap}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                    <Text style={styles.centerText}>Carregando detalhes...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error || !request) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerWrap}>
                    <Text style={styles.errorTitle}>Não foi possível abrir o pedido</Text>
                    <Text style={styles.errorText}>{error || 'Pedido indisponível.'}</Text>
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(tabs)/jobs')}>
                        <Text style={styles.primaryBtnText}>Voltar para pedidos</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const summary = request.ai_result_json?.summary_for_provider || request.user_text || 'Sem descrição detalhada.';
    const guess = request.ai_result_json?.problem_guess;
    const confidence = request.ai_result_json?.confidence;
    const address = [request.address, request.neighborhood, request.city].filter(Boolean).join(' • ') || 'Localização não informada';

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <ArrowLeft size={20} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Detalhes do pedido</Text>
                <View style={{ width: 36 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.statusCard}>
                    <Text style={styles.statusBadge}>{statusLabel(request.status)}</Text>
                    <Text style={styles.problemTitle}>{guess || request.user_text || 'Pedido de atendimento'}</Text>
                    <View style={styles.metaRow}>
                        <Clock3 size={13} color={Colors.light.textMuted} />
                        <Text style={styles.metaText}>Criado em {formatDateTime(request.created_at)}</Text>
                    </View>
                    <View style={styles.metaRow}>
                        <MapPin size={13} color={Colors.light.textMuted} />
                        <Text style={styles.metaText}>{address}</Text>
                    </View>
                    {request.dist_km != null ? (
                        <Text style={styles.distanceText}>{request.dist_km.toFixed(1)} km de distância</Text>
                    ) : null}
                </View>

                <View style={styles.infoCard}>
                    <View style={styles.cardTitleRow}>
                        <Sparkles size={16} color={Colors.light.primary} />
                        <Text style={styles.cardTitle}>Diagnóstico IA para técnico</Text>
                    </View>
                    <Text style={styles.summaryText}>{summary}</Text>
                    {confidence != null ? (
                        <Text style={styles.confidenceText}>Confiança estimada: {Math.round(Number(confidence) * 100)}%</Text>
                    ) : null}
                    {request.issue_tags?.length ? (
                        <View style={styles.tagsWrap}>
                            {request.issue_tags.map((tag) => (
                                <View key={tag} style={styles.tag}>
                                    <Text style={styles.tagText}>{tag}</Text>
                                </View>
                            ))}
                        </View>
                    ) : null}
                </View>

                <View style={styles.securityCard}>
                    <ShieldCheck size={16} color={Colors.light.success} />
                    <Text style={styles.securityText}>
                        Após confirmação do cliente, toda conversa deve acontecer no chat oficial do app.
                    </Text>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
                    <Text style={styles.rejectText}>Recusar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.offerBtn, !canOffer && styles.offerBtnDisabled]}
                    onPress={handleOffer}
                    disabled={!canOffer}
                >
                    <Text style={styles.offerText}>Fazer oferta</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    header: {
        paddingHorizontal: Layout.spacing.md,
        paddingVertical: Layout.spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: Colors.light.text,
    },
    content: {
        padding: Layout.spacing.md,
        gap: Layout.spacing.md,
        paddingBottom: 20,
    },
    statusCard: {
        backgroundColor: '#fff',
        borderRadius: Layout.radius.lg,
        borderWidth: 1,
        borderColor: Colors.light.border + '80',
        padding: Layout.spacing.md,
    },
    statusBadge: {
        alignSelf: 'flex-start',
        fontSize: 11,
        fontWeight: '700',
        color: Colors.light.primary,
        backgroundColor: Colors.light.primary + '18',
        borderRadius: Layout.radius.round,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginBottom: 8,
    },
    problemTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.light.text,
        marginBottom: 10,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    metaText: {
        flex: 1,
        fontSize: 13,
        color: Colors.light.textSecondary,
    },
    distanceText: {
        marginTop: 6,
        fontSize: 12,
        fontWeight: '700',
        color: Colors.light.primary,
    },
    infoCard: {
        backgroundColor: '#fff',
        borderRadius: Layout.radius.lg,
        borderWidth: 1,
        borderColor: Colors.light.border + '80',
        padding: Layout.spacing.md,
    },
    cardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: Colors.light.text,
    },
    summaryText: {
        fontSize: 14,
        lineHeight: 21,
        color: Colors.light.textSecondary,
    },
    confidenceText: {
        marginTop: 8,
        fontSize: 12,
        color: Colors.light.textMuted,
        fontWeight: '700',
    },
    tagsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
    },
    tag: {
        borderRadius: Layout.radius.round,
        backgroundColor: Colors.light.background,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    tagText: {
        fontSize: 12,
        color: Colors.light.textSecondary,
    },
    securityCard: {
        backgroundColor: Colors.light.successBackground,
        borderRadius: Layout.radius.md,
        borderWidth: 1,
        borderColor: '#D9F99D',
        paddingHorizontal: 10,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    securityText: {
        flex: 1,
        fontSize: 12,
        color: '#14532D',
        lineHeight: 18,
        fontWeight: '600',
    },
    footer: {
        paddingHorizontal: Layout.spacing.md,
        paddingVertical: Layout.spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.light.border,
        backgroundColor: Colors.light.background,
        flexDirection: 'row',
        gap: 10,
    },
    rejectBtn: {
        flex: 1,
        height: 44,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#FECACA',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    rejectText: {
        color: '#991B1B',
        fontSize: 14,
        fontWeight: '700',
    },
    offerBtn: {
        flex: 1.5,
        height: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.primary,
    },
    offerBtnDisabled: {
        opacity: 0.45,
    },
    offerText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '800',
    },
    centerWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Layout.spacing.xl,
        gap: 10,
    },
    centerText: {
        fontSize: 14,
        color: Colors.light.textMuted,
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.light.text,
        textAlign: 'center',
    },
    errorText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 21,
        color: Colors.light.textMuted,
    },
    primaryBtn: {
        marginTop: 8,
        backgroundColor: Colors.light.primary,
        borderRadius: 10,
        height: 44,
        paddingHorizontal: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
});
