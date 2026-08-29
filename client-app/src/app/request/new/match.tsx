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
import { Provider } from '@/types';
import { useRouter } from 'expo-router';
import { CheckCircle, Expand, MapPin, MapPinOff, MessageCircle, RefreshCw, Search, XCircle } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Easing, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { parseGeoPoint } from '@/utils/geo';

const { width, height } = Dimensions.get('window');

const INITIAL_RADIUS_KM = 5;
const MAX_RADIUS_KM = 30;
const RADIUS_STEP_KM = 10;
const DEFAULT_REGION = {
    latitude: -8.76183,
    longitude: -63.90177,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
};

const getStatusHeadline = (status: string, hasProvider: boolean): string => {
    if (status === 'offered') return 'Profissionais interessados';
    if (status === 'accepted' && !hasProvider) return 'Profissionais aceitaram seu pedido';
    if (status === 'accepted' || status === 'confirmed') return 'Pedido confirmado';
    if (status === 'en_route') return 'Profissional a caminho';
    return 'Acompanhando pedido';
};

const getStatusGuidance = (status: string, providerName?: string): string => {
    const safeProvider = providerName || 'O prestador';
    if (status === 'offered') return 'Compare as ofertas e escolha o melhor profissional para avançar.';
    if (status === 'accepted' || status === 'confirmed') return `${safeProvider} foi confirmado. Abra o chat para alinhar detalhes e agendamento.`;
    if (status === 'en_route') return `${safeProvider} está em deslocamento. Use o chat para alinhar referência e chegada.`;
    return 'Acompanhe os próximos passos do seu atendimento nesta tela.';
};

export default function RequestMatchScreen() {
    const router = useRouter();
    // Using global request state
    const {
        status,
        setStatus,
        assignedProvider,
        setAssignedProvider,
        eta,
        currentTicket,
        category,
        funnelAnswers,
        aiResult
    } = useRequest();

    const [searchRadiusKm, setSearchRadiusKm] = useState(INITIAL_RADIUS_KM);
    const { providers } = usePartners(searchRadiusKm * 1000);
    const [offerCandidates, setOfferCandidates] = useState<Array<{
        offerId: string;
        provider: Provider;
        price: number;
        estimatedTime: number;
        message: string;
    }>>([]);
    const [isLoadingOffers, setIsLoadingOffers] = useState(false);

    const mapRegion = useMemo(() => {
        const ticketLat = currentTicket?.coordinates?.latitude;
        const ticketLng = currentTicket?.coordinates?.longitude;

        if (typeof ticketLat !== 'number' || typeof ticketLng !== 'number') {
            return DEFAULT_REGION;
        }

        const latitudeDelta = 0.1; // ~11km vertical span, enough to visualize a 5km dispatch radius.
        const cosLat = Math.cos((ticketLat * Math.PI) / 180);
        const safeCos = Math.max(Math.abs(cosLat), 0.2);
        const longitudeDelta = latitudeDelta / safeCos;

        return {
            latitude: ticketLat,
            longitude: ticketLng,
            latitudeDelta,
            longitudeDelta,
        };
    }, [currentTicket?.coordinates?.latitude, currentTicket?.coordinates?.longitude]);

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
        reviews: Number(partner.reviews_count ?? partner.reviews ?? 0),
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

    const formatBRL = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

    const resolveCompletedJobs = (provider: Provider) => {
        if (provider.reviews && provider.reviews > 0) return provider.reviews;
        if (provider.operationalScore) return Math.max(12, Math.round(provider.operationalScore * 2));
        return 24;
    };

    // Provider live tracking state
    const [providerLiveLocation, setProviderLiveLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
    const [dashPhase, setDashPhase] = useState(0);
    const mapRef = useRef<MapView>(null);

    const routeGradientColors = useMemo(() => {
        if (routeCoords.length < 2) return [];
        return routeCoords.map((_, i) => {
            const t = i / (routeCoords.length - 1);
            return `rgba(34, 197, 94, ${(0.12 + t * 0.88).toFixed(3)})`;
        });
    }, [routeCoords]);

    // Marching dashes animation
    useEffect(() => {
        if (routeCoords.length < 2) return;
        const timer = setInterval(() => setDashPhase(p => (p + 3) % 24), 80);
        return () => clearInterval(timer);
    }, [routeCoords.length]);

    // Poll provider location every 8s once assigned
    useEffect(() => {
        const pId = assignedProvider?.id;
        if (!pId) return;

        const poll = async () => {
            try {
                const { data } = await supabase.from('partners').select('location').eq('id', pId).single();
                if (!data) return;
                const parsed = parseGeoPoint(data.location);
                if (!parsed) return;
                setProviderLiveLocation(prev => {
                    if (prev && Math.abs(prev.lat - parsed.lat) < 0.00005 && Math.abs(prev.lng - parsed.lng) < 0.00005) return prev;
                    return parsed;
                });
            } catch (err) {
                console.warn('[Match Poll] Error:', err);
            }
        };

        poll();
        const interval = setInterval(poll, 8000);
        return () => clearInterval(interval);
    }, [assignedProvider?.id]);

    // OSRM route when both points are known
    useEffect(() => {
        const ticketLat = currentTicket?.coordinates?.latitude;
        const ticketLng = currentTicket?.coordinates?.longitude;
        if (!ticketLat || !ticketLng || !providerLiveLocation) { setRouteCoords([]); return; }

        const getRoute = async () => {
            try {
                const url = `https://router.project-osrm.org/route/v1/driving/${ticketLng},${ticketLat};${providerLiveLocation.lng},${providerLiveLocation.lat}?overview=full&geometries=geojson`;
                const res = await fetch(url);
                const data = await res.json();
                if (data.code === 'Ok' && data.routes?.length) {
                    setRouteCoords(data.routes[0].geometry.coordinates.map((c: [number, number]) => ({ latitude: c[1], longitude: c[0] })));
                } else {
                    setRouteCoords([
                        { latitude: ticketLat, longitude: ticketLng },
                        { latitude: providerLiveLocation.lat, longitude: providerLiveLocation.lng },
                    ]);
                }
            } catch {
                setRouteCoords([
                    { latitude: ticketLat, longitude: ticketLng },
                    { latitude: providerLiveLocation.lat, longitude: providerLiveLocation.lng },
                ]);
            }
        };

        const timer = setTimeout(getRoute, 500);
        return () => clearTimeout(timer);
    }, [currentTicket?.coordinates?.latitude, currentTicket?.coordinates?.longitude, providerLiveLocation]);

    // Search timeout fallback
    const [searchTimedOut, setSearchTimedOut] = useState(false);

    useEffect(() => {
        if (status !== 'finding') {
            setSearchTimedOut(false);
            return;
        }
        const timer = setTimeout(() => setSearchTimedOut(true), 60_000);
        return () => clearTimeout(timer);
    }, [status]);

    // Animations
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const cardSlideAnim = useRef(new Animated.Value(height)).current; // Start off-screen
    const [statusText, setStatusText] = useState("Contatando profissionais próximos...");

    useEffect(() => {
        if (status === 'finding' || status === 'offered') {
            const texts = [
                "Analisando seu diagnóstico...",
                `Buscando especialistas em ${category || 'serviços'}...`,
                "Filtrando profissionais próximos...",
                "Quase lá! Aguardando novos profissionais..."
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
                .select('id, status, provider_id, price, estimated_time, message')
                .eq('request_id', currentTicket.id)
                .in('status', ['offered']);

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
                .select('id, full_name, avatar_url, rating, service_category, base_fee, is_online, operational_score')
                .in('id', providerIds);

            if (partnersError) {
                console.error('Error loading partners details:', JSON.stringify(partnersError, null, 2));
                setIsLoadingOffers(false);
                return;
            }

            const partnerMap = new Map((partners || []).map((p: any) => [p.id, mapPartnerToProvider(p)]));
            const mapped = (offersData || [])
                .map(o => {
                    const provider = partnerMap.get(o.provider_id);
                    if (!provider) return null;
                    return {
                        offerId: o.id,
                        provider,
                        price: o.price,
                        estimatedTime: o.estimated_time,
                        message: o.message
                    };
                })
                .filter(Boolean) as any[];

            if (isMounted) {
                console.log('📬 Loaded offers count:', mapped.length);
                setOfferCandidates(mapped);
                if (mapped.length > 0) {
                    setStatus('offered');
                }
            }
            setIsLoadingOffers(false);
        };

        loadOffers();

        // Fallback polling for race conditions (realtime missing events)
        let pollInterval: any;
        if (status === 'finding') {
            pollInterval = setInterval(() => {
                if (isMounted) loadOffers();
            }, 3000);
        }

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
            if (pollInterval) clearInterval(pollInterval);
            supabase.removeChannel(channel);
        };
    }, [currentTicket?.id, status]);

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

        if (status === 'finding' || status === 'offered') {
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
                    const loc = parseGeoPoint(data.location);
                    setAssignedProvider({
                        id: data.id,
                        name: data.full_name,
                        image: data.avatar_url,
                        rating: data.rating || 5.0,
                        reviews: Number(data.reviews_count ?? data.reviews ?? 0),
                        category: data.service_category,
                        categories: [data.service_category],
                        visitPrice: data.base_fee,
                        coordinates: {
                            latitude: loc?.lat || 0,
                            longitude: loc?.lng || 0
                        },
                        status: data.is_online ? 'online' : 'offline',
                        badges: [],
                        address: 'Endereço do Prestador',
                        operationalScore: 100
                    });
                    if (loc) setProviderLiveLocation(loc);
                }
            };
            fetchProvider();
        }
    }, [currentTicket?.providerId, assignedProvider]);

    useEffect(() => {
        const hasOffers = offerCandidates.length > 0;
        const shouldShowSheet =
            (hasOffers && !assignedProvider) ||
            ((status === 'offered' || status === 'accepted' || status === 'confirmed' || status === 'en_route') && !!assignedProvider);

        if (shouldShowSheet) {
            console.log('📦 Showing bottom sheet. Context status:', status, 'Offers count:', offerCandidates.length);
            Animated.spring(cardSlideAnim, {
                toValue: 0,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }).start();
        } else {
            cardSlideAnim.setValue(height);
        }
    }, [status, assignedProvider, offerCandidates.length, cardSlideAnim]);

    // Handle Declined/Cancelled State
    useEffect(() => {
        if (status === 'canceled') {
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
        if (currentTicket?.id) {
            router.push(`/chat/${currentTicket.id}`);
        }
    };

    const handleOpenTicket = () => {
        if (currentTicket?.id) {
            router.push(`/ticket/${currentTicket.id}`);
        }
    };

    const handleOpenProvider = () => {
        if (assignedProvider?.id) {
            router.push(`/provider/${assignedProvider.id}`);
        }
    };

    const handleAcceptProvider = (offer: any) => {
        if (!currentTicket?.id) return;
        if (!offer.offerId || !offer.provider?.id) {
            Alert.alert('Oferta inválida', 'Não foi possível abrir o checkout desta oferta.');
            return;
        }

        router.push({
            pathname: '/request/new/checkout',
            params: {
                requestId: currentTicket.id,
                offerId: offer.offerId,
                providerId: offer.provider.id,
                providerName: offer.provider.name || '',
                providerImage: offer.provider.image || '',
                providerCategory: offer.provider.category || '',
                providerDistance: offer.provider.distance || '',
                providerRating: String(offer.provider.rating ?? ''),
                price: String(offer.price ?? 0),
                estimatedTime: String(offer.estimatedTime ?? ''),
                message: offer.message || '',
            },
        } as any);
    };

    const offerCards = offerCandidates.map((offer) => ({ ...offer, offerId: offer.offerId }));

    return (
        <View style={styles.container}>
            {/* Background Map */}
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                customMapStyle={Platform.OS === 'android' ? BRANDED_MAP_STYLE : undefined}
                userInterfaceStyle="light"
                initialRegion={mapRegion}
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
                        tracksViewChanges={false}
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
                            tracksViewChanges={false}
                        >
                            <View style={styles.radarProviderMarker}>
                                <View style={styles.radarAvatarWrap}>
                                    <Image
                                        source={{ uri: p.image }}
                                        style={[
                                            styles.radarAvatar,
                                            p.category === category && styles.highlightedAvatar
                                        ]}
                                    />
                                </View>
                            </View>
                        </Marker>
                    );
                })}

                {/* Provider marker — uses live polled location */}
                {providerLiveLocation && (
                    <Marker
                        coordinate={{ latitude: providerLiveLocation.lat, longitude: providerLiveLocation.lng }}
                        tracksViewChanges={false}
                        anchor={{ x: 0.5, y: 0.5 }}
                    >
                        <View style={styles.assignedProviderMarker}>
                            <View style={styles.assignedAvatarWrap}>
                                <Image source={{ uri: assignedProvider?.image }} style={styles.assignedAvatar} />
                            </View>
                            <View style={styles.assignedStatusDot} />
                        </View>
                    </Marker>
                )}


                {/* Animated gradient route polyline */}
                {routeCoords.length > 1 && (
                    <Polyline
                        coordinates={routeCoords}
                        strokeColors={routeGradientColors}
                        strokeWidth={5}
                        lineDashPattern={[0]}
                    />
                )}
                {routeCoords.length > 1 && (
                    <Polyline
                        coordinates={routeCoords}
                        strokeColor="rgba(255,255,255,0.65)"
                        strokeWidth={2}
                        lineDashPattern={[6, 14]}
                        lineDashPhase={dashPhase}
                    />
                )}
            </MapView>

            {/* Floating Summary Status — only while actively searching */}
            {status === 'finding' && !searchTimedOut && (
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
                                        {aiResult.summary_for_provider}
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

            {/* Searching Overlay — hide when timed out */}
            {(status === 'finding' || status === 'offered') && !searchTimedOut && (
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

            {/* Timeout fallback — shown after 60s with no match */}
            {status === 'finding' && searchTimedOut && (
                <View style={styles.timeoutOverlay}>
                    <View style={styles.timeoutCard}>
                        <View style={styles.timeoutIconWrap}>
                            <Search size={28} color="#9CA3AF" />
                        </View>
                        <Text style={styles.timeoutTitle}>Nenhum profissional encontrado</Text>
                        <Text style={styles.timeoutSubtitle}>
                            Não conseguimos conectar você a um prestador desta vez. Veja o que pode fazer:
                        </Text>

                        <View style={styles.timeoutOptions}>
                            <TouchableOpacity
                                style={styles.timeoutOption}
                                activeOpacity={0.7}
                                onPress={() => {
                                    setSearchTimedOut(false);
                                    setStatus('finding');
                                }}
                            >
                                <View style={[styles.timeoutOptionIcon, { backgroundColor: '#EFF6FF' }]}>
                                    <RefreshCw size={20} color="#3B82F6" />
                                </View>
                                <View style={styles.timeoutOptionInfo}>
                                    <Text style={styles.timeoutOptionTitle}>Tentar novamente</Text>
                                    <Text style={styles.timeoutOptionDesc}>Profissionais podem ter ficado disponíveis</Text>
                                </View>
                            </TouchableOpacity>

                            {searchRadiusKm < MAX_RADIUS_KM && (
                                <TouchableOpacity
                                    style={styles.timeoutOption}
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        const next = Math.min(searchRadiusKm + RADIUS_STEP_KM, MAX_RADIUS_KM);
                                        setSearchRadiusKm(next);
                                        setSearchTimedOut(false);
                                        setStatus('finding');
                                    }}
                                >
                                    <View style={[styles.timeoutOptionIcon, { backgroundColor: '#F0FDF4' }]}>
                                        <Expand size={20} color="#16A34A" />
                                    </View>
                                    <View style={styles.timeoutOptionInfo}>
                                        <Text style={styles.timeoutOptionTitle}>Aumentar raio de busca</Text>
                                        <Text style={styles.timeoutOptionDesc}>
                                            Atual: {searchRadiusKm} km → {Math.min(searchRadiusKm + RADIUS_STEP_KM, MAX_RADIUS_KM)} km
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={styles.timeoutOption}
                                activeOpacity={0.7}
                                onPress={() => {
                                    router.push('/(tabs)/search');
                                }}
                            >
                                <View style={[styles.timeoutOptionIcon, { backgroundColor: '#FFF7ED' }]}>
                                    <MapPinOff size={20} color="#F59E0B" />
                                </View>
                                <View style={styles.timeoutOptionInfo}>
                                    <Text style={styles.timeoutOptionTitle}>Ninguém por perto</Text>
                                    <Text style={styles.timeoutOptionDesc}>Buscar manualmente em outra região</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.timeoutOption}
                                activeOpacity={0.7}
                                onPress={() => {
                                    router.push('/(tabs)/home');
                                }}
                            >
                                <View style={[styles.timeoutOptionIcon, { backgroundColor: '#FEF2F2' }]}>
                                    <XCircle size={20} color="#EF4444" />
                                </View>
                                <View style={styles.timeoutOptionInfo}>
                                    <Text style={styles.timeoutOptionTitle}>Região sem cobertura</Text>
                                    <Text style={styles.timeoutOptionDesc}>Voltar ao início e tentar mais tarde</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* Found Card Slide Up */}
            {(status === 'offered' || status === 'accepted' || status === 'confirmed' || status === 'en_route') && (
                <Animated.View
                    style={[
                        styles.bottomSheet,
                        { transform: [{ translateY: cardSlideAnim }] }
                    ]}
                >
                    <View style={styles.handle} />

                    {/* Offers header — only for offer selection state */}
                    {status === 'offered' && !assignedProvider && (
                        <View style={styles.successHeader}>
                            <View style={styles.successIconContainer}>
                                <CheckCircle size={28} color={Colors.light.success} fill="#fff" />
                            </View>
                            <View style={styles.successTitleContainer}>
                                <Text style={styles.successTitle}>
                                    {getStatusHeadline(status, false)}
                                </Text>
                                <Text style={styles.offerHint}>Escolha um profissional para continuar</Text>
                            </View>
                        </View>
                    )}

                    {status === 'offered' && !assignedProvider && (
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
                            {offerCards.map((offer) => {
                                const { provider, offerId, price, estimatedTime, message } = offer;
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
                                                {message ? (
                                                    <Text style={styles.offerMessage} numberOfLines={2}>{message}</Text>
                                                ) : null}
                                            </View>
                                            <View style={styles.acceptPriceBadge}>
                                                <Text style={styles.acceptPrice}>{formatBRL(price)}</Text>
                                                <Text style={styles.acceptPriceLabel}>taxa desc.</Text>
                                                {estimatedTime ? (
                                                    <Text style={styles.timeLabel}>{estimatedTime} min</Text>
                                                ) : null}
                                            </View>
                                        </View>
                                        <Button
                                            title="Ver Oferta"
                                            onPress={() => handleAcceptProvider(offer)}
                                            style={styles.acceptCta}
                                        />
                                    </View>
                                );
                            })}
                        </ScrollView>
                    )}

                    {/* Provider hero — centered layout for assigned provider */}
                    {assignedProvider && (status === 'accepted' || status === 'confirmed' || status === 'en_route') && (
                        <>
                            <View style={styles.statusBadge}>
                                <CheckCircle size={14} color={Colors.light.success} />
                                <Text style={styles.statusBadgeText}>
                                    {getStatusHeadline(status, true)}
                                </Text>
                            </View>

                            <View style={styles.providerHero}>
                                <Image source={{ uri: assignedProvider.image }} style={styles.avatarHero} />
                                <Text style={styles.providerHeroName}>{assignedProvider.name}</Text>
                                <View style={styles.providerHeroMeta}>
                                    <Text style={styles.ratingStarHero}>★</Text>
                                    <Text style={styles.ratingTextHero}>
                                        {assignedProvider.rating.toFixed(1)} ({assignedProvider.reviews})
                                    </Text>
                                    <View style={styles.metaDot} />
                                    <Text style={styles.categoryTextHero}>{assignedProvider.category}</Text>
                                </View>
                                {eta && (
                                    <Text style={styles.etaHero}>Chegada estimada: ~{eta} min</Text>
                                )}
                            </View>

                            <Text style={styles.guidanceText}>
                                {getStatusGuidance(status, assignedProvider.name)}
                            </Text>

                            <Button
                                title="Abrir chat com prestador"
                                onPress={handleOpenChat}
                                style={styles.chatCta}
                                leftIcon={<MessageCircle size={18} color="#fff" />}
                            />

                            <View style={styles.quickLinksRow}>
                                <TouchableOpacity style={styles.quickLink} onPress={handleOpenTicket} activeOpacity={0.7}>
                                    <Text style={styles.quickLinkText}>Detalhes do pedido</Text>
                                </TouchableOpacity>
                                <View style={styles.quickLinkDivider} />
                                <TouchableOpacity style={styles.quickLink} onPress={handleOpenProvider} activeOpacity={0.7}>
                                    <Text style={styles.quickLinkText}>Perfil do prestador</Text>
                                </TouchableOpacity>
                            </View>

                            {status === 'en_route' && (
                                <View style={styles.trackingPill}>
                                    <View style={styles.trackingDot} />
                                    <Text style={styles.trackingText}>Rastreando localização em tempo real</Text>
                                </View>
                            )}
                        </>
                    )}
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
    radarProviderMarker: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radarAvatarWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#fff',
        ...Layout.shadows.small,
        overflow: 'hidden',
    },
    radarAvatar: {
        width: '100%',
        height: '100%',
    },
    highlightedAvatar: {
        borderColor: Colors.light.primary,
        borderWidth: 2,
    },
    assignedProviderMarker: {
        width: 54,
        height: 54,
        alignItems: 'center',
        justifyContent: 'center',
    },
    assignedAvatarWrap: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: Colors.light.primary,
        ...Layout.shadows.medium,
        overflow: 'hidden',
    },
    assignedAvatar: {
        width: '100%',
        height: '100%',
    },
    assignedStatusDot: {
        position: 'absolute',
        top: 2,
        right: 4,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.light.success,
        borderWidth: 2,
        borderColor: '#fff',
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
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 36,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
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
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        gap: 6,
        backgroundColor: Colors.light.successBackground,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 16,
    },
    statusBadgeText: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.light.success,
    },
    providerHero: {
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarHero: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#eee',
        marginBottom: 10,
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
    },
    providerHeroName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 4,
    },
    providerHeroMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    ratingStarHero: {
        color: '#F59E0B',
        fontSize: 14,
    },
    ratingTextHero: {
        color: '#6B7280',
        fontSize: 13,
        fontWeight: '500',
    },
    metaDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#D1D5DB',
        marginHorizontal: 4,
    },
    categoryTextHero: {
        color: Colors.light.primary,
        fontSize: 13,
        fontWeight: '600',
    },
    etaHero: {
        marginTop: 8,
        fontSize: 13,
        color: Colors.light.textSecondary,
        fontWeight: '500',
    },
    guidanceText: {
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 18,
        paddingHorizontal: 8,
    },
    chatCta: {
        backgroundColor: Colors.light.success,
        borderRadius: 14,
        paddingVertical: 15,
        marginBottom: 14,
    },
    quickLink: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
    },
    quickLinkText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.light.primary,
    },
    quickLinkDivider: {
        width: 1,
        height: 20,
        backgroundColor: '#E5E7EB',
        alignSelf: 'center',
    },
    trackingPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#F0F9FF',
        borderRadius: 20,
        alignSelf: 'center',
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
        color: '#1F2937',
        marginBottom: 2,
    },
    acceptCategory: {
        fontSize: 13,
        color: Colors.light.primary,
        fontWeight: '500',
        marginBottom: 4,
    },
    offerMessage: {
        fontSize: 13,
        color: '#4B5563',
        fontStyle: 'italic',
        marginTop: 6,
    },
    acceptMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    acceptMeta: {
        fontSize: 12,
        color: '#6B7280',
    },
    acceptPriceBadge: {
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    acceptPrice: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1F2937',
    },
    acceptPriceLabel: {
        fontSize: 10,
        color: Colors.light.textSecondary,
        fontWeight: '600',
    },
    timeLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.light.success,
        marginTop: 4,
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden'
    },
    acceptCta: {
        backgroundColor: Colors.light.primary,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 16,
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
    quickLinksRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
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
    },
    timeoutOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
        paddingHorizontal: 24,
    },
    timeoutCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 28,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 12,
    },
    timeoutIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    timeoutTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
        textAlign: 'center',
    },
    timeoutSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    timeoutOptions: {
        width: '100%',
        gap: 10,
    },
    timeoutOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 16,
        backgroundColor: '#FAFAFA',
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    timeoutOptionIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    timeoutOptionInfo: {
        flex: 1,
    },
    timeoutOptionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 2,
    },
    timeoutOptionDesc: {
        fontSize: 12,
        color: '#9CA3AF',
        lineHeight: 16,
    },
});
