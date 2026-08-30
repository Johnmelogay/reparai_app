import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/Colors';
import { useRequest } from '@/context/RequestContext';
import { supabase } from '@/services/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, Banknote, ChevronLeft, CreditCard, ShieldCheck } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CheckoutScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        requestId?: string | string[];
        offerId?: string | string[];
        providerId?: string | string[];
        providerName?: string | string[];
        providerImage?: string | string[];
        providerCategory?: string | string[];
        providerDistance?: string | string[];
        providerRating?: string | string[];
        price?: string | string[];
        estimatedTime?: string | string[];
        message?: string | string[];
    }>();
    const { setAssignedProvider, setStatus, currentTicket, resetFunnel } = useRequest();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<'credit_card' | 'pix' | 'cash'>('credit_card');

    const getParam = (value?: string | string[]): string => Array.isArray(value) ? value[0] || '' : (value || '');

    const requestId = getParam(params.requestId) || currentTicket?.id || '';
    const offerId = getParam(params.offerId);
    const providerId = getParam(params.providerId);
    const providerName = getParam(params.providerName);
    const providerImage = getParam(params.providerImage);
    const providerCategory = getParam(params.providerCategory);
    const providerDistance = getParam(params.providerDistance);
    const providerRating = getParam(params.providerRating);
    const priceRaw = Number.parseFloat(getParam(params.price));
    const price = Number.isFinite(priceRaw) ? priceRaw : 0;
    const estimatedTime = getParam(params.estimatedTime);
    const message = getParam(params.message);

    // Platform fee logic (e.g. 10% or fixed 5 BRL, let's say it's fixed 5 BRL for this MVP)
    const platformFee = 5.00;
    const total = price + platformFee;

    const hasRequiredParams = !!requestId && !!offerId && !!providerId;

    useEffect(() => {
        if (!hasRequiredParams) {
            Alert.alert('Erro', 'Dados da oferta inválidos.', [
                { text: 'Voltar', onPress: () => router.back() }
            ]);
        }
    }, [hasRequiredParams, router]);

    const handleConfirmOrder = async () => {
        if (!hasRequiredParams || isSubmitting) return;
        setIsSubmitting(true);

        // 1. Call RPC to confirm order
        const { error: rpcError } = await supabase.rpc('confirm_order', {
            p_request_id: requestId,
            p_offer_id: offerId,
            p_payment_method: selectedPayment
        });

        if (rpcError) {
            console.error('Error confirming order:', rpcError);
            Alert.alert('Erro de Confirmação', rpcError?.message || 'Não foi possível confirmar o pedido no servidor. Tente novamente.');
            setIsSubmitting(false);
            return;
        }

        // 2. Fetch provider details to set in context
        const { data: providerData, error: providerError } = await supabase
            .from('partners')
            .select('*')
            .eq('id', providerId)
            .single();

        if (providerData && !providerError) {
            setAssignedProvider({
                id: providerData.id,
                name: providerData.full_name,
                image: providerData.avatar_url,
                rating: providerData.rating || 5.0,
                reviews: Number(providerData.reviews_count ?? providerData.reviews ?? 0),
                category: providerData.service_category,
                categories: [providerData.service_category],
                visitPrice: String(price),
                distance: 'próximo',
                coordinates: {
                    latitude: providerData.lat || 0,
                    longitude: providerData.long || 0
                },
                status: providerData.is_online ? 'online' : 'offline',
                badges: [],
                address: providerData.address_label || 'Endereço Indisponível',
                operationalScore: providerData.operational_score || 100
            });
            setStatus('confirmed');
        } else {
            setAssignedProvider({
                id: providerId,
                name: providerName || 'Prestador',
                image: providerImage || 'https://via.placeholder.com/150',
                rating: providerRating ? Number(providerRating) : 5,
                reviews: 0,
                category: providerCategory || 'Serviço',
                categories: providerCategory ? [providerCategory] : ['servico'],
                visitPrice: String(price),
                distance: providerDistance || 'próximo',
                coordinates: { latitude: 0, longitude: 0 },
                status: 'online',
                badges: [],
                address: 'Endereço indisponível',
                operationalScore: 100,
            });
            setStatus('confirmed');
        }

        const targetRequestId = requestId;
        resetFunnel();
        setStatus('confirmed');
        setIsSubmitting(false);

        // Discard request funnel modal stack and navigate to ticket
        if (router.canDismiss()) {
            router.dismissAll();
        }
        router.push(`/ticket/${targetRequestId}?showSuccess=true`);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} disabled={isSubmitting}>
                    <ChevronLeft size={24} color="#1F2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Confirmar Solicitação</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <Card style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <ShieldCheck size={20} color={Colors.light.success} />
                        <Text style={styles.sectionTitle}>Profissional Selecionado</Text>
                    </View>
                    <View style={styles.providerInfo}>
                        <View>
                            <Text style={styles.providerName}>
                                {providerName || `Profissional #${providerId.slice(0, 4)}`}
                            </Text>
                            <Text style={styles.providerMeta}>Chegará em aprox. {estimatedTime} min</Text>
                        </View>
                    </View>
                    {message ? (
                        <View style={styles.messageBox}>
                            <Text style={styles.messageLabel}>Mensagem do profissional:</Text>
                            <Text style={styles.messageText}>{message}</Text>
                        </View>
                    ) : null}
                </Card>

                <Card style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Resumo do Deslocamento</Text>

                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Taxa de deslocamento combinada</Text>
                        <Text style={styles.priceValue}>R$ {price.toFixed(2).replace('.', ',')}</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={[styles.priceRow, { marginTop: 12 }]}>
                        <Text style={styles.totalLabel}>Valor a pagar no local</Text>
                        <Text style={styles.totalValue}>R$ {price.toFixed(2).replace('.', ',')}</Text>
                    </View>
                </Card>

                <View style={styles.paymentMethods}>
                    <Text style={styles.sectionTitle}>Forma de Pagamento no Local</Text>
                    <Text style={styles.sectionSubtitle}>Como você prefere pagar a taxa de deslocamento diretamente ao profissional?</Text>

                    <TouchableOpacity
                        style={[styles.paymentOption, selectedPayment === 'pix' && styles.paymentOptionSelected]}
                        onPress={() => setSelectedPayment('pix')}
                    >
                        <View style={styles.paymentIconWrap}>
                            <Banknote size={20} color={selectedPayment === 'pix' ? Colors.light.primary : '#6B7280'} />
                        </View>
                        <View style={styles.paymentTextWrap}>
                            <Text style={styles.paymentTitle}>Pix (no local)</Text>
                            <Text style={styles.paymentDesc}>Direto na chave Pix do profissional</Text>
                        </View>
                        <View style={[styles.radio, selectedPayment === 'pix' && styles.radioSelected]} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.paymentOption, selectedPayment === 'credit_card' && styles.paymentOptionSelected]}
                        onPress={() => setSelectedPayment('credit_card')}
                    >
                        <View style={styles.paymentIconWrap}>
                            <CreditCard size={20} color={selectedPayment === 'credit_card' ? Colors.light.primary : '#6B7280'} />
                        </View>
                        <View style={styles.paymentTextWrap}>
                            <Text style={styles.paymentTitle}>Cartão (no local)</Text>
                            <Text style={styles.paymentDesc}>Pague na maquininha do profissional</Text>
                        </View>
                        <View style={[styles.radio, selectedPayment === 'credit_card' && styles.radioSelected]} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.paymentOption, selectedPayment === 'cash' && styles.paymentOptionSelected]}
                        onPress={() => setSelectedPayment('cash')}
                    >
                        <View style={styles.paymentIconWrap}>
                            <Banknote size={20} color={selectedPayment === 'cash' ? Colors.light.primary : '#6B7280'} />
                        </View>
                        <View style={styles.paymentTextWrap}>
                            <Text style={styles.paymentTitle}>Dinheiro (no local)</Text>
                            <Text style={styles.paymentDesc}>Pague em espécie ao profissional</Text>
                        </View>
                        <View style={[styles.radio, selectedPayment === 'cash' && styles.radioSelected]} />
                    </TouchableOpacity>
                </View>

                <View style={styles.warningBox}>
                    <AlertCircle size={20} color="#B45309" />
                    <Text style={styles.warningText}>
                        O pagamento da taxa de deslocamento e do orçamento do serviço é combinado e acertado diretamente com o profissional no local.
                    </Text>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <Button
                    title={isSubmitting ? "Confirmando..." : "Confirmar Solicitação"}
                    onPress={handleConfirmOrder}
                    disabled={isSubmitting || !hasRequiredParams}
                    style={styles.cta}
                />
                {!isSubmitting && (
                    <Text style={styles.footerTerms}>
                        Ao confirmar, você solicita o deslocamento do profissional até seu endereço.
                    </Text>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        gap: 16,
    },
    sectionCard: {
        padding: 20,
        borderRadius: 16,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#F3F4F6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
        marginLeft: 8,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 16,
        marginTop: -8,
    },
    providerInfo: {
        backgroundColor: '#F9FAFB',
        padding: 16,
        borderRadius: 12,
    },
    providerName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1F2937',
    },
    providerMeta: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 4,
    },
    messageBox: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: Colors.light.primary,
    },
    messageLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1E3A8A',
        marginBottom: 2,
    },
    messageText: {
        fontSize: 14,
        color: '#1E3A8A',
        fontStyle: 'italic',
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    priceLabel: {
        fontSize: 14,
        color: '#4B5563',
    },
    priceValue: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1F2937',
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 8,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.light.primary,
    },
    paymentMethods: {
        marginTop: 8,
    },
    paymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        marginBottom: 12,
    },
    paymentOptionSelected: {
        borderColor: Colors.light.primary,
        backgroundColor: '#F5F8FF',
    },
    paymentIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    paymentTextWrap: {
        flex: 1,
    },
    paymentTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1F2937',
    },
    paymentDesc: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        backgroundColor: '#fff',
    },
    radioSelected: {
        borderColor: Colors.light.primary,
        borderWidth: 6,
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FEF3C7',
        padding: 16,
        borderRadius: 12,
        marginTop: 4,
    },
    warningText: {
        flex: 1,
        fontSize: 13,
        color: '#92400E',
        marginLeft: 12,
        lineHeight: 18,
    },
    footer: {
        padding: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    cta: {
        backgroundColor: '#111827',
        height: 56,
        borderRadius: 28,
    },
    ctaText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    footerTerms: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 12,
    }
});
