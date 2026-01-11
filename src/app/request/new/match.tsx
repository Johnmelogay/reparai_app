/**
 * File: src/app/request/new/match.tsx
 * Purpose: The "Searching" screen where users wait for a provider.
 * Key Features:
 * - Displays a pulsing "Radar" animation to indicate searching.
 * - Listens to `currentTicket` status to trigger "Match Found".
 * - Shows the "Provider Found" bottom sheet with provider details.
 * - Handles transitions to the active chat/order screen.
 */
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors, Layout } from '@/constants/Colors';
import { BRANDED_MAP_STYLE } from '@/constants/MapStyles';
import { useRequest } from '@/context/RequestContext';
import { usePartners } from '@/hooks/usePartners';
import { QUESTION_SETS } from '@/services/questionsData';
import { supabase } from '@/services/supabase';
import { useRouter } from 'expo-router';
import { CheckCircle, MapPin } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { ActivityIndicator, Alert, Animated, Dimensions, Easing, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Provider } from '@/types';

const { width, height } = Dimensions.get('window');

const INITIAL_REGION = {
    latitude: -8.76183,
    longitude: -63.90177,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
};

export default function RequestMatchScreen() {
    const router = useRouter();
    // Using global request state
    const {
        status,
        setStatus,
        assignedProvider,
        setAssignedProvider,
        cancelRequest,
        eta,
        currentTicket,
        category,
        funnelAnswers,
        aiResult,
        offers
    } = useRequest();

    const { providers } = usePartners();
    const [offerCandidates, setOfferCandidates] = useState<Array<{ offerId: string; provider: Provider }>>([]);
    const [isLoadingOffers, setIsLoadingOffers] = useState(false);

    // Filter relevant providers for visual radar
    const nearbyProviders = providers.filter(p => {
        // Show all if category is generic or matches
        if (!category) return true;

        // Map UI categories to DB categories
        // 'mecanica' -> 'auto', 'electronics' -> 'tech', etc if needed
        const normalizedRequestCat = category.toLowerCase() === 'mecanica' ? 'auto' : category.toLowerCase();

        const pCat = p.category?.toLowerCase() || '';
        const pCats = p.categories?.map(c => c.toLowerCase()) || [];

        return pCat.includes(normalizedRequestCat) ||
            pCats.some(c => c.includes(normalizedRequestCat)) ||
            // Fallback: If request is 'agro' or 'mecanica', show 'auto' too
            (normalizedRequestCat === 'auto' && pCat.includes('mecanica')) ||
            (normalizedRequestCat === 'mecanica' && pCat.includes('auto'));
    });

    // If no specific match, show ALL nearby to avoid empty map (Demo Fallback)
    const visibleProviders = nearbyProviders.length > 0 ? nearbyProviders : providers;

    // Limit for performance
    const renderProviders = visibleProviders.slice(0, 10);

    const questionSet = QUESTION_SETS[category || 'electronics'] || QUESTION_SETS['electronics'];

    const mapPartnerToProvider = (partner: any): Provider => ({
        id: partner.id,
        name: partner.full_name || 'Prestador',
        image: partner.avatar_url || 'https://via.placeholder.com/150',
        rating: partner.rating || 5.0,
        reviews: partner.reviews_count || 0,
        category: partner.service_category || 'Geral',
        categories: partner.categories ? partner.categories : [partner.service_category].filter(Boolean),
        hourlyRate: partner.hourly_rate || 100,
        distance: partner.dist_km ? `${partner.dist_km.toFixed(1)}km` : '...',
        coordinates: {
            latitude: Number(partner.lat) || 0,
            longitude: Number(partner.long) || 0,
        },
        status: partner.is_online ? 'online' : 'offline',
        badges: [],
        address: partner.address_label || 'Prestador',
        visitPrice: partner.base_fee ? `${partner.base_fee}` : undefined,
        operationalScore: partner.operational_score || 100,
    });

    const parseDistanceKm = (provider: Provider) => {
        if (typeof provider.rawDistance === 'number' && !isNaN(provider.rawDistance)) {
            return provider.rawDistance;
        }
        if (provider.distance) {
            const normalized = provider.distance.replace(',', '.').toLowerCase();
            const kmMatch = normalized.match(/([\d.]+)\s*km/);
            if (kmMatch) return parseFloat(kmMatch[1]);
            const mMatch = normalized.match(/([\d.]+)\s*m/);
            if (mMatch) return parseFloat(mMatch[1]) / 1000;
        }
        return null;
    };

    const estimateDisplacementFee = (provider: Provider) => {
        const baseFee = 12;
        const perKm = 3.5;
        const km = parseDistanceKm(provider);
        const fee = km != null ? baseFee + km * perKm : 18;
        return Math.max(baseFee, Math.round(fee * 2) / 2);
    };

    const formatBRL = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

    const resolveCompletedJobs = (provider: Provider) => {
        if (provider.reviews && provider.reviews > 0) return provider.reviews;
        if (provider.operationalScore) return Math.max(12, Math.round(provider.operationalScore * 2));
        return 24;
    };

    // Animations
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const cardSlideAnim = useRef(new Animated.Value(height)).current; // Start off-screen
    const [statusText, setStatusText] = useState("Contatando profissionais próximos...");

    useEffect(() => {
        if (status === 'finding' || status === 'NEW' || status === 'OFFERED') {
            const texts = [
                "Analisando seu diagnóstico...",
                `Buscando especialistas em ${category || 'serviços'}...`,
                "Filtrando profissionais próximos...",
                "Quase lá! Aguardando resposta..."
            ];
            let i = 0;
            const interval = setInterval(() => {
                i = (i + 1) % texts.length;
                setStatusText(texts[i]);
            }, 3500);
            return () => clearInterval(interval);
        }
    }, [status, category]);

    useEffect(() => {
        if (!currentTicket?.id) return;
        let isMounted = true;
        const loadOffers = async () => {
            setIsLoadingOffers(true);
            const { data: offersData, error } = await supabase
                .from('provider_offers')
                .select('id, status, provider_id')
                .eq('request_id', currentTicket.id)
                .in('status', ['answered']);

            if (error) {
                console.error('Error loading offers', error);
                setIsLoadingOffers(false);
                return;
            }

            const providerIds = Array.from(new Set((offersData || []).map(o => o.provider_id).filter(Boolean)));
            if (providerIds.length === 0) {
                if (isMounted) setOfferCandidates([]);
                setIsLoadingOffers(false);
                return;
            }

            const { data: partners, error: partnersError } = await supabase
                .from('partners')
                .select('id, full_name, avatar_url, rating, reviews_count, service_category, categories, hourly_rate, base_fee, lat, long, is_online, operational_score, dist_km, address_label')
                .in('id', providerIds);

            if (partnersError) {
                console.error('Error loading partners', partnersError);
                setIsLoadingOffers(false);
                return;
            }

            const partnerMap = new Map((partners || []).map((p: any) => [p.id, mapPartnerToProvider(p)]));
            const mapped = (offersData || [])
                .map(o => {
                    const provider = partnerMap.get(o.provider_id);
                    if (!provider) return null;
                    return { offerId: o.id, provider };
                })
                .filter(Boolean) as Array<{ offerId: string; provider: Provider }>;

            if (isMounted) setOfferCandidates(mapped);
            setIsLoadingOffers(false);
        };

        loadOffers();

        const channel = supabase
            .channel(`request_offers_${currentTicket.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'provider_offers',
                    filter: `request_id=eq.${currentTicket.id}`,
                },
                () => {
                    loadOffers();
                }
            )
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, [currentTicket?.id]);

    useEffect(() => {
        // Pulse Animation active during NEW/OFFERED status
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 2000,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0,
                    duration: 0,
                    useNativeDriver: true,
                }),
            ])
        );

        if (status === 'finding' || status === 'NEW' || status === 'OFFERED') {
            animation.start();
        } else {
            animation.stop();
            pulseAnim.setValue(0);
        }

        return () => animation.stop();
    }, [status]);

    useEffect(() => {
        if (currentTicket?.providerId && !assignedProvider) {
            const fetchProvider = async () => {
                const { data, error } = await supabase
                    .from('partners')
                    .select('*')
                    .eq('id', currentTicket.providerId)
                    .single();

                if (data) {
                    setAssignedProvider({
                        id: data.id,
                        name: data.full_name,
                        image: data.avatar_url,
                        rating: data.rating || 5.0,
                        reviews: 100,
                        category: data.service_category,
                        categories: [data.service_category],
                        visitPrice: data.base_fee,
                        distance: '2.0 km',
                        coordinates: {
                            latitude: data.lat || 0,
                            longitude: data.long || 0
                        },
                        status: data.is_online ? 'online' : 'offline',
                        badges: [],
                        address: 'Endereço do Prestador',
                        operationalScore: 100
                    });
                }
            };
            fetchProvider();
        }
    }, [currentTicket?.providerId, assignedProvider]);

    useEffect(() => {
        const shouldShowSheet =
            (status === 'answered' && !assignedProvider) ||
            ((status === 'ACCEPTED' || status === 'PAID' || status === 'EN_ROUTE') && assignedProvider);

        if (shouldShowSheet) {
            Animated.spring(cardSlideAnim, {
                toValue: 0,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }).start();
        } else {
            cardSlideAnim.setValue(height);
        }
    }, [status, assignedProvider, cardSlideAnim]);

    // Handle Declined/Cancelled State
    useEffect(() => {
        if (status === 'CANCELED' || status === 'declined' || status === 'expired') {
            Alert.alert(
                'Solicitação Encerrada',
                'Não conseguimos encontrar um profissional disponível ou a solicitação foi cancelada.',
                [
                    {
                        text: 'Tentar Novamente',
                        onPress: () => router.back() // Go back to details to resubmit
                    },
                    {
                        text: 'Ir para Início',
                        style: 'cancel',
                        onPress: () => router.push('/(tabs)/home')
                    }
                ]
            );
        }
    }, [status]);

    const handleOpenChat = () => {
        if (assignedProvider) {
            router.push(`/chat/${assignedProvider.id}`);
        }
    };

    const handleCancel = () => {
        cancelRequest();
        router.push('/(tabs)/home');
    };

    const handleAcceptProvider = async (provider: Provider, offerId?: string | null) => {
        if (!currentTicket?.id) return;

        const { error: rpcError } = await supabase.rpc('choose_provider', {
            request_id: currentTicket.id,
            provider_id: provider.id
        });

        if (rpcError) {
            console.error('choose_provider failed', rpcError);
            Alert.alert('Erro', rpcError.message || 'Não foi possível confirmar o profissional.');
            return;
        }

        setAssignedProvider(provider);
        setStatus('ACCEPTED');
    };

    const offerCards = status === 'answered'
        ? offerCandidates.map(o => ({ ...o, offerId: o.offerId }))
        : offers.length > 0
            ? offers.map(o => ({ offerId: null, provider: o.provider }))
            : renderProviders.map(p => ({ offerId: null, provider: p }));

    return (
        <View style={styles.container}>
            {/* Background Map */}
            <MapView
                style={StyleSheet.absoluteFill}
                provider={Platform.OS === 'android' || Platform.OS === 'ios' ? PROVIDER_GOOGLE : undefined}
                customMapStyle={BRANDED_MAP_STYLE}
                initialRegion={INITIAL_REGION}
                userInterfaceStyle="light"
                onMapReady={() => console.log('🗺️ Match map ready')}
                onMapLoaded={() => console.log('🗺️ Match map loaded')}
            >
                {/* User Marker */}
                {currentTicket?.coordinates &&
                    typeof currentTicket.coordinates.latitude === 'number' &&
                    !isNaN(currentTicket.coordinates.latitude) &&
                    !isNaN(currentTicket.coordinates.longitude) ? (
                    <Marker
                        coordinate={{
                            latitude: currentTicket.coordinates.latitude,
                            longitude: currentTicket.coordinates.longitude
                        }}
                        anchor={{ x: 0.5, y: 0.5 }}
                        zIndex={1000}
                    >
                        <View style={styles.userMarkerOut}>
                            <Image
                                source={require('../../../../assets/images/wavinghuman.png')}
                                style={{ width: 52, height: 52 }}
                                resizeMode="contain"
                            />
                        </View>
                    </Marker>
                ) : null}

                {/* VISIBLE PROVIDERS (LIVE RADAR) */}
                {!assignedProvider && renderProviders.map(p => {
                    if (!p.coordinates ||
                        typeof p.coordinates.latitude !== 'number' ||
                        typeof p.coordinates.longitude !== 'number' ||
                        isNaN(p.coordinates.latitude) ||
                        isNaN(p.coordinates.longitude)) return null;

                    return (
                        <Marker
                            key={p.id}
                            coordinate={p.coordinates}
                            anchor={{ x: 0.5, y: 0.5 }}
                            opacity={0.8}
                        >
                            <View style={styles.miniProviderMarker}>
                                <Image
                                    source={{ uri: p.image }}
                                    style={[
                                        styles.miniAvatar,
                                        // Highlight if matches category exactly
                                        p.category === category && styles.highlightedAvatar
                                    ]}
                                />
                            </View>
                        </Marker>
                    );
                })}

                {/* Show Provider Marker only when found */}
                {assignedProvider && assignedProvider.coordinates &&
                    typeof assignedProvider.coordinates.latitude === 'number' &&
                    !isNaN(assignedProvider.coordinates.latitude) &&
                    !isNaN(assignedProvider.coordinates.longitude) && (
                        <Marker coordinate={assignedProvider.coordinates}>
                            <Image source={{ uri: assignedProvider.image }} style={styles.mapAvatar} />
                        </Marker>
                    )}
            </MapView>

            {/* Floating Summary Status (C9) */}
            {(status === 'finding' || status === 'NEW') && (
                <View style={styles.floatingSummary}>
                    <Card style={styles.statusCard} padding={0}>
                        <View style={{ padding: 16 }}>
                            <View style={styles.statusHeader}>
                                <ActivityIndicator size="small" color={Colors.light.primary} />
                                <Text style={styles.statusTitle}>{statusText}</Text>
                            </View>
                            <Text style={styles.statusSub}>Analisando {questionSet.questions.length} filtros e proximidade</Text>

                            <View style={styles.miniDivider} />

                            <Text style={styles.miniLabel}>Resumo da Solicitação:</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll}>
                                {Object.entries(funnelAnswers).map(([key, val]) => {
                                    let label = val;
                                    if (val === 'true') label = 'Sim';
                                    if (val === 'false') label = 'Não';
                                    if (val === 'unknown') label = 'Não sei';
                                    return (
                                        <View key={key} style={styles.tag}>
                                            <Text style={styles.tagText}>{label}</Text>
                                        </View>
                                    );
                                })}
                            </ScrollView>

                            {/* AI Summary Section */}
                            {aiResult && aiResult.summary_for_provider && (
                                <View style={{ marginTop: 16 }}>
                                    <View style={styles.miniDivider} />
                                    <Text style={styles.miniLabel}>Diagnóstico IA (Para Técnico):</Text>
                                    <Text style={styles.aiSummaryText}>
                                        "{aiResult.summary_for_provider}"
                                    </Text>
                                    {aiResult.tags && (
                                        <View style={[styles.tagScroll, { marginTop: 8 }]}>
                                            {aiResult.tags.map((tag: string, idx: number) => (
                                                <View key={idx} style={[styles.tag, { backgroundColor: '#E0F2FE' }]}>
                                                    <Text style={[styles.tagText, { color: '#0369A1' }]}>#{tag}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    </Card>
                </View>
            )}

            {/* Searching Overlay */}
            {(status === 'finding' || status === 'NEW' || status === 'OFFERED') && (
                <View style={styles.radarContainer}>
                    <Animated.View
                        style={[
                            styles.pulseRing,
                            {
                                opacity: pulseAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.6, 0]
                                }),
                                transform: [{
                                    scale: pulseAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [1, 4]
                                    })
                                }]
                            }
                        ]}
                    />
                    <View style={styles.centerMarker}>
                        <MapPin size={32} color="#fff" fill={Colors.light.primary} />
                    </View>
                    <View style={styles.statusPill}>
                        <Text style={styles.statusText}>{statusText}</Text>
                    </View>
                </View>
            )}

            {/* Found Card Slide Up */}
            {(status === 'answered' || status === 'ACCEPTED' || status === 'PAID' || status === 'EN_ROUTE') && (
                <Animated.View
                    style={[
                        styles.bottomSheet,
                        { transform: [{ translateY: cardSlideAnim }] }
                    ]}
                >
                    <View style={styles.handle} />

                    <View style={styles.successHeader}>
                        <View style={styles.successIconContainer}>
                            <CheckCircle size={28} color={Colors.light.success} fill="#fff" />
                        </View>
                        <View style={styles.successTitleContainer}>
                            <Text style={styles.successTitle}>
                                {status === 'answered' ? 'Profissionais interessados' :
                                    status === 'ACCEPTED' && !assignedProvider ? 'Profissionais aceitaram seu pedido' :
                                    status === 'ACCEPTED' ? 'Aguardando Pagamento' :
                                    status === 'PAID' ? 'Pedido Confirmado' :
                                        'Profissional a caminho'}
                            </Text>
                            {status === 'EN_ROUTE' && eta && (
                                <Text style={styles.etaText}>Chegada estimada: {eta} minutos</Text>
                            )}
                            {status === 'answered' && (
                                <Text style={styles.offerHint}>Escolha um profissional para continuar</Text>
                            )}
                        </View>
                    </View>

                    {status === 'answered' && !assignedProvider && (
                        <ScrollView
                            style={styles.acceptList}
                            contentContainerStyle={styles.acceptListContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {isLoadingOffers && (
                                <View style={styles.offerLoadingRow}>
                                    <ActivityIndicator size="small" color={Colors.light.primary} />
                                    <Text style={styles.offerLoadingText}>Carregando ofertas...</Text>
                                </View>
                            )}
                            {!isLoadingOffers && offerCards.length === 0 && (
                                <View style={styles.offerEmptyState}>
                                    <Text style={styles.offerEmptyTitle}>Nenhum profissional respondeu ainda</Text>
                                    <Text style={styles.offerEmptyText}>
                                        Assim que alguém aceitar, a lista aparece aqui automaticamente.
                                    </Text>
                                </View>
                            )}
                            {offerCards.map(({ provider, offerId }) => {
                                const fee = estimateDisplacementFee(provider);
                                const completedJobs = resolveCompletedJobs(provider);
                                return (
                                    <View key={`${provider.id}-${offerId || 'fallback'}`} style={styles.acceptCard}>
                                        <View style={styles.acceptCardHeader}>
                                            <Image source={{ uri: provider.image }} style={styles.acceptAvatar} />
                                            <View style={styles.acceptMainInfo}>
                                                <Text style={styles.acceptName}>{provider.name}</Text>
                                                <Text style={styles.acceptCategory}>{provider.category}</Text>
                                                <View style={styles.acceptMetaRow}>
                                                    <Text style={styles.acceptMeta}>★ {provider.rating.toFixed(1)} ({provider.reviews})</Text>
                                                    <Text style={styles.acceptMeta}>• {completedJobs} trabalhos</Text>
                                                    <Text style={styles.acceptMeta}>• {provider.distance || 'próximo'}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.acceptPriceBadge}>
                                                <Text style={styles.acceptPrice}>{formatBRL(fee)}</Text>
                                                <Text style={styles.acceptPriceLabel}>taxa est.</Text>
                                            </View>
                                        </View>
                                        <Button
                                            title="Aceitar este profissional"
                                            onPress={() => handleAcceptProvider(provider, offerId)}
                                            style={styles.acceptCta}
                                        />
                                    </View>
                                );
                            })}
                        </ScrollView>
                    )}

                    {assignedProvider && (
                        <View style={styles.providerRow}>
                            <Image source={{ uri: assignedProvider.image }} style={styles.avatarLarge} />
                            <View style={styles.providerInfo}>
                                <Text style={styles.providerName}>{assignedProvider.name}</Text>
                                <View style={styles.ratingRow}>
                                    <Text style={styles.ratingStars}>★★★★★</Text>
                                    <Text style={styles.ratingCount}>5.0 ({assignedProvider.reviews})</Text>
                                </View>
                                <Text style={styles.carInfo}>Chevrolet Onix • ABC-1234</Text>
                            </View>
                            <View style={styles.timeBadge}>
                                <Text style={styles.timeText}>5 min</Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.actions}>
                        {status === 'ACCEPTED' && assignedProvider && (
                            <View style={{ gap: 12 }}>
                                <View style={styles.feeInfo}>
                                    <Text style={styles.feeLabel}>Taxa de deslocamento</Text>
                                    <Text style={styles.feeValue}>R$ 15,00</Text>
                                </View>
                                <Button
                                    title="Confirmar e Pagar"
                                    onPress={async () => {
                                        if (!currentTicket?.id) return;
                                        const { error } = await supabase
                                            .from('requests')
                                            .update({ status: 'paid' })
                                            .eq('id', currentTicket.id);
                                        if (error) {
                                            Alert.alert('Erro', 'Não foi possível atualizar o status.');
                                        }
                                    }}
                                    style={{ backgroundColor: Colors.light.primary }}
                                />
                                <TouchableOpacity
                                    onPress={async () => {
                                        if (!currentTicket?.id) return;
                                        const { error } = await supabase
                                            .from('requests')
                                            .update({ status: 'declined', provider_id: null })
                                            .eq('id', currentTicket.id);
                                        if (error) {
                                            Alert.alert('Erro', 'Não foi possível recusar o profissional.');
                                        }
                                    }}
                                    style={styles.declineBtn}
                                >
                                    <Text style={styles.declineText}>Recusar este profissional</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {(status === 'PAID' || status === 'EN_ROUTE') && (
                            <>
                                <Button
                                    title="Enviar Mensagem"
                                    onPress={handleOpenChat}
                                    style={{ backgroundColor: Colors.light.success }}
                                />
                                {status === 'EN_ROUTE' && (
                                    <View style={styles.trackingInfo}>
                                        <View style={styles.trackingDot} />
                                        <Text style={styles.trackingText}>Rastreando localização em tempo real</Text>
                                    </View>
                                )}
                            </>
                        )}
                        <Button
                            title="Cancelar"
                            variant="ghost"
                            onPress={handleCancel}
                            style={{ marginTop: 10 }}
                        />
                    </View>
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f2f2f2',
    },
    userMarkerOut: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    userMarkerIn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4,
    },
    mapAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#fff',
    },
    miniProviderMarker: {
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    miniAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#fff',
        opacity: 0.8
    },
    highlightedAvatar: {
        borderColor: Colors.light.primary,
        borderWidth: 2,
        width: 36,
        height: 36,
        borderRadius: 18,
        opacity: 1
    },
    radarContainer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pulseRing: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.light.success,
        position: 'absolute',
    },
    centerMarker: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
    },
    statusPill: {
        marginTop: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statusText: {
        fontWeight: '600',
        color: '#333',
    },
    bottomSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#E5E5EA',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    successHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    successIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.light.successBackground,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    successTitleContainer: {
        flex: 1,
    },
    successTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.light.success,
    },
    etaText: {
        fontSize: 13,
        color: Colors.light.textSecondary,
        marginTop: 4,
    },
    providerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    avatarLarge: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#eee',
    },
    providerInfo: {
        flex: 1,
        marginLeft: 16,
    },
    providerName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    ratingStars: {
        color: '#F59E0B',
        fontSize: 12,
    },
    ratingCount: {
        color: '#666',
        fontSize: 12,
        marginLeft: 4,
    },
    carInfo: {
        color: '#999',
        fontSize: 12,
        marginTop: 4,
    },
    timeBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    timeText: {
        fontWeight: 'bold',
        color: '#333',
    },
    offerHint: {
        marginTop: 4,
        fontSize: 13,
        color: Colors.light.textSecondary,
        fontWeight: '500',
    },
    acceptList: {
        maxHeight: 360,
    },
    acceptListContent: {
        gap: 12,
        paddingBottom: 8,
    },
    acceptCard: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        ...Layout.shadows.small,
    },
    acceptCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    acceptAvatar: {
        width: 56,
        height: 56,
        borderRadius: 18,
        marginRight: 12,
        borderWidth: 2,
        borderColor: '#fff',
    },
    acceptMainInfo: {
        flex: 1,
    },
    acceptName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111',
    },
    acceptCategory: {
        marginTop: 2,
        fontSize: 13,
        color: Colors.light.textSecondary,
        fontWeight: '600',
    },
    acceptMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 6,
        gap: 6,
    },
    acceptMeta: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    acceptPriceBadge: {
        backgroundColor: '#F0FDF4',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        alignItems: 'flex-end',
        borderWidth: 1,
        borderColor: '#DCFCE7',
    },
    acceptPrice: {
        fontSize: 14,
        fontWeight: '800',
        color: Colors.light.success,
    },
    acceptPriceLabel: {
        fontSize: 10,
        color: Colors.light.textSecondary,
        fontWeight: '600',
    },
    acceptCta: {
        backgroundColor: Colors.light.primary,
    },
    offerLoadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 6,
    },
    offerLoadingText: {
        fontSize: 13,
        color: Colors.light.textSecondary,
        fontWeight: '500',
    },
    offerEmptyState: {
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        gap: 6,
    },
    offerEmptyTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    offerEmptyText: {
        fontSize: 12,
        color: '#64748B',
        textAlign: 'center',
    },
    actions: {
        gap: 10,
    },
    trackingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        padding: 12,
        backgroundColor: '#F0F9FF',
        borderRadius: 8,
    },
    trackingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.light.primary,
        marginRight: 8,
    },
    trackingText: {
        fontSize: 12,
        color: Colors.light.textSecondary,
        fontWeight: '500',
    },
    floatingSummary: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        zIndex: 50,
    },
    statusCard: {
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        ...Layout.shadows.medium,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 8,
    },
    statusTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.light.text,
    },
    statusSub: {
        fontSize: 12,
        color: '#666',
        marginBottom: 10,
    },
    miniDivider: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.05)',
        marginBottom: 10,
    },
    miniLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#999',
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    tagScroll: {
        flexDirection: 'row',
    },
    tag: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginRight: 8,
    },
    tagText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#555',
    },
    feeInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    feeLabel: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
    },
    feeValue: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.light.primary,
    },
    declineBtn: {
        alignItems: 'center',
        padding: 12,
    },
    declineText: {
        color: '#999',
        fontSize: 14,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    aiSummaryText: {
        fontSize: 14,
        color: '#444',
        lineHeight: 20,
        fontStyle: 'italic',
        marginTop: 4,
        backgroundColor: 'rgba(0,0,0,0.02)',
        padding: 8,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: Colors.light.primary,
    }
});
