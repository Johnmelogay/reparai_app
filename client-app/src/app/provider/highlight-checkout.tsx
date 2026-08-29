/**
 * Highlight Checkout Screen
 * iFood-style price breakdown: Service Price + Displacement Fee + Platform Fee
 * After confirmation → creates a request and navigates to chat.
 */
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { useRequest } from '@/context/RequestContext';
import { supabase } from '@/services/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    AlertCircle,
    Banknote,
    ChevronLeft,
    CreditCard,
    Image as ImageIcon,
    MessageCircle,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const formatBRL = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

export default function HighlightCheckoutScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        highlightId?: string;
        providerId?: string;
        providerName?: string;
        serviceName?: string;
        servicePrice?: string;
        displacementFee?: string;
        imageUrl?: string;
    }>();
    const { setAssignedProvider, setStatus } = useRequest();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<'credit_card' | 'pix' | 'cash'>('pix');

    const get = (v?: string) => v || '';

    const highlightId = get(params.highlightId);
    const providerId = get(params.providerId);
    const providerName = get(params.providerName);
    const serviceName = get(params.serviceName);
    const imageUrl = get(params.imageUrl);

    const servicePrice = Number(params.servicePrice) || 0;
    const displacementFee = Number(params.displacementFee) || 0;
    const platformFee = 5.0; // Fixed MVP fee
    const total = servicePrice + displacementFee + platformFee;

    const handleConfirm = async () => {
        if (!providerId || !highlightId) {
            Alert.alert('Erro', 'Dados incompletos.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Não autenticado');

            // Create a request linked to this highlight
            const { data: request, error: reqError } = await supabase
                .from('requests')
                .insert({
                    user_id: user.id,
                    provider_id: providerId,
                    status: 'confirmed',
                    category: 'highlight',
                    user_text: `Serviço: ${serviceName}`,
                    payment_method: selectedPayment,
                    displacement_fee: displacementFee,
                })
                .select('id')
                .single();

            if (reqError) throw reqError;

            // Set context state
            setAssignedProvider({
                id: providerId,
                name: providerName || 'Prestador',
                image: '',
                rating: 5,
                reviews: 0,
                category: 'highlight',
                categories: ['highlight'],
                visitPrice: String(displacementFee),
                distance: '',
                coordinates: { latitude: 0, longitude: 0 },
                status: 'online',
                badges: [],
                address: '',
                operationalScore: 100,
            });
            setStatus('confirmed');

            // Navigate to chat
            router.replace({
                pathname: '/chat/[id]',
                params: { id: request.id },
            });
        } catch (err: any) {
            Alert.alert('Erro', err?.message || 'Não foi possível confirmar. Tente novamente.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} disabled={isSubmitting}>
                    <ChevronLeft size={24} color="#1F2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Contratar Serviço</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {/* Service Card */}
                <View style={styles.serviceCard}>
                    {imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={styles.serviceImage} />
                    ) : (
                        <View style={[styles.serviceImage, styles.imagePlaceholder]}>
                            <ImageIcon size={28} color="#CBD5E1" />
                        </View>
                    )}
                    <View style={styles.serviceInfo}>
                        <Text style={styles.serviceName}>{serviceName}</Text>
                        <Text style={styles.providerLabel}>por {providerName}</Text>
                    </View>
                </View>

                {/* Price Breakdown */}
                <View style={styles.priceCard}>
                    <Text style={styles.sectionTitle}>Resumo de Valores</Text>

                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Serviço</Text>
                        <Text style={styles.priceValue}>{formatBRL(servicePrice)}</Text>
                    </View>

                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Taxa de deslocamento</Text>
                        <Text style={styles.priceValue}>
                            {displacementFee > 0 ? formatBRL(displacementFee) : 'Grátis'}
                        </Text>
                    </View>

                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Taxa da plataforma</Text>
                        <Text style={styles.priceValue}>{formatBRL(platformFee)}</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={[styles.priceRow, { marginTop: 4 }]}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>{formatBRL(total)}</Text>
                    </View>
                </View>

                {/* Payment Methods */}
                <View style={styles.paymentSection}>
                    <Text style={styles.sectionTitle}>Forma de Pagamento</Text>

                    <TouchableOpacity
                        style={[styles.paymentOption, selectedPayment === 'pix' && styles.paymentSelected]}
                        onPress={() => setSelectedPayment('pix')}
                    >
                        <View style={styles.paymentIcon}>
                            <Banknote size={20} color={selectedPayment === 'pix' ? Colors.light.primary : '#6B7280'} />
                        </View>
                        <View style={styles.paymentText}>
                            <Text style={styles.paymentTitle}>Pix</Text>
                            <Text style={styles.paymentDesc}>Aprovação imediata</Text>
                        </View>
                        <View style={[styles.radio, selectedPayment === 'pix' && styles.radioActive]} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.paymentOption, selectedPayment === 'credit_card' && styles.paymentSelected]}
                        onPress={() => setSelectedPayment('credit_card')}
                    >
                        <View style={styles.paymentIcon}>
                            <CreditCard size={20} color={selectedPayment === 'credit_card' ? Colors.light.primary : '#6B7280'} />
                        </View>
                        <View style={styles.paymentText}>
                            <Text style={styles.paymentTitle}>Cartão de Crédito</Text>
                            <Text style={styles.paymentDesc}>Pagamento via app</Text>
                        </View>
                        <View style={[styles.radio, selectedPayment === 'credit_card' && styles.radioActive]} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.paymentOption, selectedPayment === 'cash' && styles.paymentSelected]}
                        onPress={() => setSelectedPayment('cash')}
                    >
                        <View style={styles.paymentIcon}>
                            <Banknote size={20} color={selectedPayment === 'cash' ? Colors.light.primary : '#6B7280'} />
                        </View>
                        <View style={styles.paymentText}>
                            <Text style={styles.paymentTitle}>Dinheiro</Text>
                            <Text style={styles.paymentDesc}>Pague ao profissional</Text>
                        </View>
                        <View style={[styles.radio, selectedPayment === 'cash' && styles.radioActive]} />
                    </TouchableOpacity>
                </View>

                {selectedPayment === 'cash' && (
                    <View style={styles.warningBox}>
                        <AlertCircle size={18} color="#B45309" />
                        <Text style={styles.warningText}>
                            Combine o troco com o profissional pelo chat após a confirmação.
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* Footer CTA */}
            <View style={styles.footer}>
                <Button
                    title={isSubmitting ? 'Confirmando...' : 'Confirmar e Abrir Chat'}
                    onPress={handleConfirm}
                    disabled={isSubmitting}
                    leftIcon={!isSubmitting ? <MessageCircle size={18} color="#fff" /> : undefined}
                    size="lg"
                    style={styles.cta}
                />
                <Text style={styles.footerTerms}>
                    Após confirmar, você poderá combinar detalhes com o profissional pelo chat.
                </Text>
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
    scroll: { flex: 1 },
    scrollContent: {
        padding: 20,
        gap: 16,
    },
    // Service card
    serviceCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        gap: 14,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    serviceImage: {
        width: 64,
        height: 64,
        borderRadius: 12,
    },
    imagePlaceholder: {
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    serviceInfo: { flex: 1 },
    serviceName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
    },
    providerLabel: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    // Price breakdown
    priceCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 14,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
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
        marginVertical: 10,
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
    // Payment
    paymentSection: {
        marginTop: 4,
    },
    paymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        marginBottom: 10,
    },
    paymentSelected: {
        borderColor: Colors.light.primary,
        backgroundColor: '#FFF7ED',
    },
    paymentIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    paymentText: { flex: 1 },
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
    radioActive: {
        borderColor: Colors.light.primary,
        borderWidth: 6,
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FEF3C7',
        padding: 14,
        borderRadius: 12,
        gap: 10,
    },
    warningText: {
        flex: 1,
        fontSize: 13,
        color: '#92400E',
        lineHeight: 18,
    },
    // Footer
    footer: {
        padding: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    cta: {
        backgroundColor: Colors.light.primary,
    },
    footerTerms: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 12,
    },
});
