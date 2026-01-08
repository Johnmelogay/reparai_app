import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors, Layout } from '@/constants/Colors';
import { useRequest } from '@/context/RequestContext';
import { NEARBY_PROVIDERS } from '@/services/mockData';
import { useRouter } from 'expo-router';
import { CheckCircle, Clock, MapPin, Star, Verified } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

const { width } = Dimensions.get('window');

export default function SelectProviderScreen() {
    const router = useRouter();
    const { setOffers, setAssignedProvider, setStatus, category, offers } = useRequest();
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Simulate receiving offers
    useEffect(() => {
        const timer = setTimeout(() => {
            // Generate mock offers from nearby providers
            const offers = NEARBY_PROVIDERS.filter(p => 
                !category || p.categories.includes(category || '')
            ).slice(0, 3).map(provider => ({
                provider,
                price: Math.floor(Math.random() * 100) + 50,
                estimatedTime: Math.floor(Math.random() * 30) + 15,
                message: `Olá! Posso ajudar com ${category || 'seu serviço'}. Tenho experiência e posso chegar em aproximadamente ${Math.floor(Math.random() * 30) + 15} minutos.`,
            }));

            setOffers(offers);
            setLoading(false);
        }, 1500);

        return () => clearTimeout(timer);
    }, []);

    const handleSelectProvider = (providerId: string) => {
        setSelectedProviderId(providerId);
    };

    const handleConfirm = () => {
        if (!selectedProviderId) return;

        const selectedOffer = offers.find(o => o.provider.id === selectedProviderId);
        if (selectedOffer) {
            setAssignedProvider(selectedOffer.provider);
            setStatus('ACCEPTED');
            router.push('/request/new/match');
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text style={styles.backButton}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Escolher Profissional</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                    <Text style={styles.loadingText}>Buscando profissionais...</Text>
                    <Text style={styles.loadingSubtext}>Enviando sua solicitação para profissionais próximos</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.backButton}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Escolher Profissional</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView 
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.infoBanner}>
                    <Text style={styles.infoBannerText}>
                        {offers.length} profissionais disponíveis na sua região
                    </Text>
                </View>

                {offers.map((offer, index) => {
                    const isSelected = selectedProviderId === offer.provider.id;
                    return (
                        <TouchableOpacity
                            key={offer.provider.id}
                            onPress={() => handleSelectProvider(offer.provider.id)}
                            style={styles.offerCard}
                        >
                            <Card style={[
                                styles.offerCardContent,
                                isSelected && styles.offerCardSelected
                            ]}>
                                <View style={styles.offerHeader}>
                                    <View style={styles.providerImageContainer}>
                                        <Image
                                            source={{ uri: offer.provider.image }}
                                            style={styles.providerImage}
                                            contentFit="cover"
                                        />
                                        {offer.provider.badges?.includes('verified') && (
                                            <View style={styles.verifiedBadge}>
                                                <Verified size={12} color="#fff" fill="#3B82F6" />
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.providerInfo}>
                                        <View style={styles.providerNameRow}>
                                            <Text style={styles.providerName}>{offer.provider.name}</Text>
                                            {isSelected && (
                                                <CheckCircle size={20} color={Colors.light.primary} fill={Colors.light.primary} />
                                            )}
                                        </View>
                                        <View style={styles.ratingRow}>
                                            <Star size={14} color="#F59E0B" fill="#F59E0B" />
                                            <Text style={styles.ratingText}>
                                                {offer.provider.rating} ({offer.provider.reviews} avaliações)
                                            </Text>
                                        </View>
                                        <View style={styles.distanceRow}>
                                            <MapPin size={12} color={Colors.light.textSecondary} />
                                            <Text style={styles.distanceText}>
                                                {offer.provider.distance} • {offer.provider.address}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {offer.message && (
                                    <View style={styles.messageContainer}>
                                        <Text style={styles.messageText}>{offer.message}</Text>
                                    </View>
                                )}

                                <View style={styles.offerFooter}>
                                    <View style={styles.priceContainer}>
                                        <Text style={styles.priceLabel}>Orçamento</Text>
                                        <Text style={styles.priceValue}>R$ {offer.price.toFixed(2)}</Text>
                                    </View>
                                    <View style={styles.timeContainer}>
                                        <Clock size={14} color={Colors.light.textSecondary} />
                                        <Text style={styles.timeText}>{offer.estimatedTime} min</Text>
                                    </View>
                                </View>
                            </Card>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <View style={styles.footer}>
                <Button
                    title={selectedProviderId ? "Confirmar e Continuar" : "Selecione um profissional"}
                    onPress={handleConfirm}
                    disabled={!selectedProviderId}
                />
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    backButton: {
        fontSize: 24,
        color: Colors.light.text,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.light.text,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    loadingText: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.light.text,
        marginTop: 20,
        marginBottom: 8,
    },
    loadingSubtext: {
        fontSize: 14,
        color: Colors.light.textSecondary,
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 100,
    },
    infoBanner: {
        backgroundColor: Colors.light.successBackground,
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
    },
    infoBannerText: {
        fontSize: 14,
        color: Colors.light.success,
        fontWeight: '600',
        textAlign: 'center',
    },
    offerCard: {
        marginBottom: 16,
    },
    offerCardContent: {
        padding: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    offerCardSelected: {
        borderColor: Colors.light.primary,
        backgroundColor: '#FFF9F0',
    },
    offerHeader: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    providerImageContainer: {
        position: 'relative',
        marginRight: 12,
    },
    providerImage: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#eee',
    },
    verifiedBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 2,
    },
    providerInfo: {
        flex: 1,
    },
    providerNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    providerName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.light.text,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    ratingText: {
        fontSize: 13,
        color: Colors.light.textSecondary,
        marginLeft: 4,
    },
    distanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    distanceText: {
        fontSize: 12,
        color: Colors.light.textSecondary,
        marginLeft: 4,
    },
    messageContainer: {
        backgroundColor: '#F9FAFB',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
        marginTop: 8,
    },
    messageText: {
        fontSize: 13,
        color: Colors.light.text,
        lineHeight: 18,
    },
    offerFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    priceContainer: {
        flex: 1,
    },
    priceLabel: {
        fontSize: 11,
        color: Colors.light.textSecondary,
        marginBottom: 2,
    },
    priceValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.light.primary,
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    timeText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.light.text,
        marginLeft: 4,
    },
    footer: {
        padding: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        ...Layout.shadows.medium,
    },
});

