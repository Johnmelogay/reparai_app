import { Button } from '@/components/ui/Button';
import { Colors, Layout } from '@/constants/Colors';
import { useRequest } from '@/context/RequestContext';
import { supabase } from '@/services/supabase';
import { TicketStatus } from '@/types';
import { BlurView } from 'expo-blur';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
    BadgeCheck,
    Banknote,
    CheckCircle,
    Clock,
    CreditCard,
    FileText,
    History,
    MapPin,
    MessageSquare,
    Phone,
    Shield,
    Star,
    Navigation,
    Wrench,
    X
} from 'lucide-react-native';
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, View, Dimensions, TouchableOpacity, Image, Platform, Keyboard, KeyboardAvoidingView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import SuccessModal from '@/components/SuccessModal';
import { Card } from '@/components/ui/Card';
import { BRANDED_MAP_STYLE } from '@/constants/MapStyles';
import { calculateApproximateDistance, formatApproximateDistance, parseGeoPoint } from '@/utils/geo';


const { width, height } = Dimensions.get('window');

// Mirrors the same asset mapping used in home.tsx
const CATEGORY_IMAGES: Record<string, any> = {
    auto:         require('../../../assets/images/car_tire_car_services.png'),
    electronics:  require('../../../assets/images/electric_plug.png'),
    hvac:         require('../../../assets/images/ac_unit.png'),
    plumbing:     require('../../../assets/images/plumber.png'),
    gardening:    require('../../../assets/images/gardening.png'),
    cleaning:     require('../../../assets/images/cleaning.png'),
    beauty:       require('../../../assets/images/nail_polish.png'),
    carpentry:    require('../../../assets/images/wrench_tool.png'),
    pest_control: require('../../../assets/images/pest_control.png'),
    handyman:     require('../../../assets/images/wrench_tool.png'),
    electrical:   require('../../../assets/images/electric_plug.png'),
    mobilidade:   require('../../../assets/images/car_tire_car_services.png'),
    default:      require('../../../assets/images/wrench_tool.png'),
};

function getCategoryImage(category?: string | null) {
    const c = String(category || '').toLowerCase();
    if (c === 'auto' || c === 'mobilidade' || c.includes('mec') || c.includes('car')) return CATEGORY_IMAGES.auto;
    if (c === 'electronics' || c.includes('eletrôn') || c.includes('cell'))           return CATEGORY_IMAGES.electronics;
    if (c === 'hvac' || c.includes('ar') || c.includes('clim') || c.includes('refrig')) return CATEGORY_IMAGES.hvac;
    if (c === 'plumbing' || c.includes('hidra') || c.includes('encan'))               return CATEGORY_IMAGES.plumbing;
    if (c === 'gardening' || c.includes('jardin'))                                    return CATEGORY_IMAGES.gardening;
    if (c === 'cleaning' || c.includes('limp'))                                       return CATEGORY_IMAGES.cleaning;
    if (c === 'beauty' || c.includes('beleza') || c.includes('manic'))                return CATEGORY_IMAGES.beauty;
    if (c === 'carpentry' || c.includes('marc') || c.includes('madeira'))             return CATEGORY_IMAGES.carpentry;
    if (c === 'pest_control' || c.includes('dedet'))                                  return CATEGORY_IMAGES.pest_control;
    if (c === 'electrical' || c.includes('eletri'))                                   return CATEGORY_IMAGES.electrical;
    if (c === 'handyman' || c.includes('marido') || c.includes('geral'))              return CATEGORY_IMAGES.handyman;
    return CATEGORY_IMAGES.default;
}

const STATUS_CONFIG: Record<TicketStatus, { label: string; icon: any; color: string; bg: string }> = {
    draft: { label: 'Rascunho', icon: Clock, color: '#6B7280', bg: '#F3F4F6' },
    finding: { label: 'Buscando Profissionais', icon: Clock, color: '#3B82F6', bg: '#DBEAFE' },
    offered: { label: 'Propostas Recebidas', icon: BadgeCheck, color: '#8B5CF6', bg: '#EDE9FE' },
    answered: { label: 'Propostas Recebidas', icon: BadgeCheck, color: '#8B5CF6', bg: '#EDE9FE' },
    accepted: { label: 'Proposta Selecionada', icon: BadgeCheck, color: '#0284C7', bg: '#E0F2FE' },
    confirmed: { label: 'Pedido Confirmado', icon: BadgeCheck, color: Colors.light.success, bg: Colors.light.successBackground },
    en_route: { label: 'A caminho do local', icon: Navigation, color: Colors.light.primary, bg: '#FFF4E6' },
    arrived: { label: 'Prestador no local', icon: MapPin, color: '#0284C7', bg: '#E0F2FE' },
    quote_provided: { label: 'Orçamento Enviado', icon: FileText, color: '#D97706', bg: '#FEF3C7' },
    quote_accepted: { label: 'Serviço em Andamento', icon: Wrench, color: '#10B981', bg: '#D1FAE5' },
    done: { label: 'Serviço Concluído', icon: CheckCircle, color: Colors.light.success, bg: Colors.light.successBackground },
    declined: { label: 'Recusado', icon: X, color: '#6B7280', bg: '#F3F4F6' },
    canceled: { label: 'Cancelado', icon: X, color: '#EF4444', bg: '#FEE2E2' },
    expired: { label: 'Expirado', icon: Clock, color: '#9CA3AF', bg: '#F3F4F6' },
    disputed: { label: 'Em Disputa', icon: Shield, color: '#DC2626', bg: '#FEE2E2' },
};

function getTrackingSubtitle(
    status: 'confirmed' | 'en_route',
    distStr: string | null,
    etaMin: number | null
): string {
    const hasDist = !!distStr;
    const hasEta = etaMin != null && Number.isFinite(etaMin) && etaMin > 0;

    if (status === 'confirmed') {
        if (hasDist && hasEta) return `${distStr} • previsão de ~${etaMin} min`;
        if (hasEta) return `Previsão de ~${etaMin} min`;
        if (hasDist) return `${distStr} de distância`;
        return 'Previsão indisponível';
    }

    // en_route
    if (hasDist && hasEta) return `${distStr} • chegada em ~${etaMin} min`;
    if (hasEta) return `Chegada em ~${etaMin} min`;
    if (hasDist) return `${distStr} de distância`;
    return 'Previsão indisponível';
}

interface TicketData {
    id: string;
    status: TicketStatus;
    category: string;
    user_text: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
    displacement_fee: number | null;
    displacement_payment_method?: string | null;
    service_quote?: number | null;
    service_payment_method?: string | null;
    service_payment_status?: string | null;
    provider_id: string | null;
    created_at: string;
    updated_at: string;
    ai_result_json: any;
    answers_json?: any;
    done_provider_at: string | null;
    done_client_at: string | null;
}



interface ProviderData {
    id: string;
    full_name: string;
    avatar_url: string | null;
    rating: number | null;
    service_category?: string | null;
    location?: {
        lat: number;
        lng: number;
    };
    phone?: string;
}

function toFiniteNumber(value: unknown): number | null {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
}

export default function TicketDetailScreen() {

    const { id, showSuccess } = useLocalSearchParams();
    const router = useRouter();
    const { currentTicket, loadTicket, eta: contextEta } = useRequest();
    const mapRef = useRef<MapView>(null);

    const [ticket, setTicket] = useState<TicketData | null>(null);
    const [provider, setProvider] = useState<ProviderData | null>(null);
    const [estimatedTime, setEstimatedTime] = useState<number | null>(() => {
        if (currentTicket?.id === id && typeof contextEta === 'number') {
            return contextEta;
        }
        return null;
    });

    const approximateDistanceStr = useMemo(() => {
        if (!ticket?.lat || !ticket?.lng || !provider?.location) return null;
        const distKm = calculateApproximateDistance(
            { latitude: ticket.lat, longitude: ticket.lng },
            { latitude: provider.location.lat, longitude: provider.location.lng }
        );
        return formatApproximateDistance(distKm);
    }, [ticket?.lat, ticket?.lng, provider?.location]);

    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [routeCoords, setRouteCoords] = useState<{ latitude: number, longitude: number }[]>([]);
    const hasFittedRouteRef = useRef(false);
    const lastFitTimestampRef = useRef(0);
    const [dashPhase, setDashPhase] = useState(0);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [ratingVisible, setRatingVisible] = useState(false);
    const [ratingValue, setRatingValue] = useState(0);
    const [ratingComment, setRatingComment] = useState('');
    const [ratingLoading, setRatingLoading] = useState(false);

    const [acceptQuoteLoading, setAcceptQuoteLoading] = useState(false);
    const [quotePaymentMethod, setQuotePaymentMethod] = useState<'pix' | 'cash' | 'credit_card'>('pix');

    const handleAcceptQuote = useCallback(async () => {
        if (!ticket || acceptQuoteLoading) return;
        Alert.alert(
            'Aprovar Orçamento',
            `Deseja aprovar o orçamento de R$ ${(ticket.service_quote || 0).toFixed(2).replace('.', ',')} para execução do serviço?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Aprovar',
                    onPress: async () => {
                        try {
                            setAcceptQuoteLoading(true);
                            const { error } = await supabase.rpc('client_accept_quote', {
                                p_request_id: ticket.id,
                                p_payment_method: quotePaymentMethod,
                            });
                            if (error) throw error;
                            Alert.alert('Orçamento aprovado!', 'O prestador foi notificado e pode iniciar o serviço.');
                        } catch (err: any) {
                            Alert.alert('Erro ao aprovar', err.message || 'Não foi possível aprovar o orçamento.');
                        } finally {
                            setAcceptQuoteLoading(false);
                        }
                    },
                },
            ]
        );
    }, [ticket, quotePaymentMethod, acceptQuoteLoading]);

    const handleConfirmDone = useCallback(async () => {
        if (!ticket || confirmLoading) return;
        Alert.alert(
            'Confirmar conclusão',
            'Você confirma que o serviço foi realizado com sucesso?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Confirmar',
                    onPress: async () => {
                        try {
                            setConfirmLoading(true);
                            const { error } = await supabase.rpc('client_confirm_done', { p_request_id: ticket.id });
                            if (error) throw error;
                        } catch (err: any) {
                            Alert.alert('Erro', err.message || 'Não foi possível confirmar.');
                        } finally {
                            setConfirmLoading(false);
                        }
                    },
                },
            ]
        );
    }, [ticket, confirmLoading]);

    const handleSubmitRating = useCallback(async () => {
        if (!ticket || !provider || ratingValue === 0 || ratingLoading) return;
        try {
            setRatingLoading(true);
            const { error } = await supabase.rpc('submit_review', {
                p_request_id: ticket.id,
                p_rating: ratingValue,
                p_comment: ratingComment.trim() || null,
            });
            if (error) throw error;
            setRatingVisible(false);
            Alert.alert('Obrigado!', 'Sua avaliação foi enviada.', [
                {
                    text: 'OK',
                    onPress: () => router.replace('/(tabs)/home'),
                },
            ]);
        } catch (err: any) {
            Alert.alert('Erro', err.message || 'Não foi possível enviar a avaliação.');
        } finally {
            setRatingLoading(false);
        }
    }, [ticket, provider, ratingValue, ratingComment, ratingLoading, router]);

    const handleCancelTicket = useCallback(() => {
        if (!ticket?.id) return;
        Alert.alert(
            'Cancelar pedido?',
            'Tem certeza que deseja cancelar sua solicitação de serviço?',
            [
                { text: 'Voltar', style: 'cancel' },
                {
                    text: 'Sim, cancelar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase.rpc('client_cancel_request', {
                                p_request_id: ticket.id,
                                p_reason: 'Cancelado na tela de detalhes do pedido',
                            });
                            if (error) throw error;
                            Alert.alert('Pedido cancelado', 'Sua solicitação foi cancelada.');
                            router.replace('/(tabs)/requests');
                        } catch (e: any) {
                            Alert.alert('Erro ao cancelar', e?.message || 'Não foi possível cancelar o pedido.');
                        }
                    },
                },
            ]
        );
    }, [ticket?.id, router]);

    // Gradient: faded at client end → solid green at provider end (conveys direction of travel)
    const routeGradientColors = useMemo(() => {
        if (routeCoords.length < 2) return [];
        return routeCoords.map((_, i) => {
            const t = i / (routeCoords.length - 1);
            const alpha = (0.12 + t * 0.88).toFixed(3);
            return `rgba(34, 197, 94, ${alpha})`;
        });
    }, [routeCoords]);

    // Marching dashes — runs only while route is visible, very lightweight
    useEffect(() => {
        if (routeCoords.length < 2) return;
        const timer = setInterval(() => setDashPhase(p => (p + 3) % 24), 80);
        return () => clearInterval(timer);
    }, [routeCoords.length]);

    
    // Handle the success modal trigger from URL params
    useEffect(() => {
        if (showSuccess === 'true') {
            setShowModal(true);
        }
    }, [showSuccess]);

    // Check if we already have it in context
    const contextHasTicket = currentTicket?.id === id;

    // 1. Data Fetch function (reusable for initial mount and focus refresh)
    const fetchTicket = useCallback(async (options?: { silent?: boolean }) => {
        if (!id) return;
        const silent = options?.silent ?? false;
        try {
            if (!silent) {
                setLoading(true);
            }
            const { data, error } = await supabase
                .from('requests')
                .select('*')
                .eq('id', id as string)
                .single();

            if (error) throw error;
            if (!data) throw new Error('Ticket não encontrado');

            setTicket({
                id: data.id,
                status: (data.status || 'finding') as TicketStatus,
                category: data.category || 'Geral',
                user_text: data.user_text,
                address: data.address,
                lat: data.lat,
                lng: data.lng,
                displacement_fee: data.displacement_fee,
                displacement_payment_method: data.displacement_payment_method,
                service_quote: data.service_quote,
                service_payment_method: data.service_payment_method,
                service_payment_status: data.service_payment_status,
                provider_id: data.provider_id,
                created_at: data.created_at,
                updated_at: data.updated_at,
                ai_result_json: data.ai_result_json,
                answers_json: data.answers_json,
                done_provider_at: data.done_provider_at || null,
                done_client_at: data.done_client_at || null,
            });

            if (data.provider_id) {
                console.log('[Ticket] Fetching partner:', data.provider_id);
                const { data: partnerData, error: partnerError } = await supabase
                    .from('partners')
                    .select('id, full_name, avatar_url, rating, service_category, location, phone')
                    .eq('id', data.provider_id)
                    .single();

                if (partnerError) console.error('[Ticket] Partner fetch error:', partnerError);
                console.log('[Ticket] Raw partner data:', JSON.stringify(partnerData)?.slice(0, 300));

                if (partnerData) {
                    const parsedLocation = parseGeoPoint(partnerData.location);
                    console.log('[Ticket] Parsed provider location:', parsedLocation);
                    setProvider({
                        ...partnerData,
                        location: parsedLocation || undefined
                    });
                }
            }

            // Fetch accepted offer ETA if not already available
            try {
                const { data: offerData } = await supabase
                    .from('provider_offers')
                    .select('estimated_time')
                    .eq('request_id', id as string)
                    .eq('status', 'accepted')
                    .maybeSingle();

                if (offerData?.estimated_time != null) {
                    setEstimatedTime(offerData.estimated_time);
                }
            } catch (offerErr) {
                console.warn('[Ticket] Could not fetch accepted offer ETA:', offerErr);
            }
        } catch (err: any) {
            if (!silent) {
                setFetchError(err.message || 'Erro ao carregar ticket');
            } else {
                console.warn('[Ticket] Silent refetch error:', err?.message || err);
            }
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [id]);

    // Initial Data Fetch
    useEffect(() => {
        fetchTicket({ silent: false });
    }, [fetchTicket]);

    // Focus Refetch (Defensive fallback when returning from chat or other screens)
    useFocusEffect(
        useCallback(() => {
            fetchTicket({ silent: true });
        }, [fetchTicket])
    );

    // 2. Realtime Ticket Subscription
    useEffect(() => {
        if (!id) return;
        const channel = supabase
            .channel(`ticket_changes_${id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'requests', filter: `id=eq.${id}` },
                (payload) => {
                    console.log('⚡ Ticket updated via Realtime:', payload.new.status);
                    setTicket(prev => prev ? {
                        ...prev,
                        status: payload.new.status,
                        provider_id: payload.new.provider_id,
                        service_quote: payload.new.service_quote,
                        service_payment_method: payload.new.service_payment_method,
                        service_payment_status: payload.new.service_payment_status,
                        displacement_payment_method: payload.new.displacement_payment_method,
                        done_provider_at: payload.new.done_provider_at || null,
                        done_client_at: payload.new.done_client_at || null,
                    } : prev);
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') console.log(`🔌 Channel ticket_changes_${id} subscribed`);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id]);

    // 3. Provider Tracking Subscription (Only if provider_id exists)
    useEffect(() => {
        const pId = ticket?.provider_id;
        if (!pId) return;

        console.log('🚛 Starting provider tracking for:', pId);
        const providerChannel = supabase
            .channel(`provider_tracking_${pId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'partners', filter: `id=eq.${pId}` },
                (payload) => {
                    const parsedLocation = parseGeoPoint(payload.new.location);
                    if (!parsedLocation) {
                        console.warn('[Realtime] Received invalid location:', payload.new.location);
                        return;
                    }

                    setProvider(prev => {
                        if (!prev) return prev;

                        const prevLoc = prev.location;
                        if (
                            prevLoc &&
                            Math.abs(prevLoc.lat - parsedLocation.lat) < 0.0001 &&
                            Math.abs(prevLoc.lng - parsedLocation.lng) < 0.0001
                        ) {
                            return prev;
                        }

                        console.log('📍 Provider location updated:', parsedLocation);
                        return {
                            ...prev,
                            location: parsedLocation,
                        };
                    });
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') console.log(`🔌 Channel provider_tracking_${pId} subscribed`);
            });

        return () => {
            supabase.removeChannel(providerChannel);
        };
    }, [ticket?.provider_id]);

    // 3b. Poll provider location every 8 seconds for smooth displacement tracking
    useEffect(() => {
        const pId = ticket?.provider_id;
        const isTracking = pId && ['confirmed', 'en_route'].includes(ticket?.status ?? '');
        if (!isTracking) return;

        const pollLocation = async () => {
            try {
                const { data } = await supabase
                    .from('partners')
                    .select('location')
                    .eq('id', pId)
                    .single();

                if (!data) return;
                const parsed = parseGeoPoint(data.location);
                if (!parsed) return;

                setProvider(prev => {
                    if (!prev) return prev;
                    const prevLoc = prev.location;
                    if (
                        prevLoc &&
                        Math.abs(prevLoc.lat - parsed.lat) < 0.00005 &&
                        Math.abs(prevLoc.lng - parsed.lng) < 0.00005
                    ) {
                        return prev; // no meaningful change
                    }
                    return { ...prev, location: parsed };
                });

            } catch (err) {
                console.warn('[Poll] Error fetching provider location:', err);
            }
        };

        // Initial poll immediately
        pollLocation();
        const interval = setInterval(pollLocation, 8000);
        return () => clearInterval(interval);
    }, [ticket?.provider_id, ticket?.status]);

    useEffect(() => {
        const ticketLat = toFiniteNumber(ticket?.lat);
        const ticketLng = toFiniteNumber(ticket?.lng);
        const providerLat = toFiniteNumber(provider?.location?.lat);
        const providerLng = toFiniteNumber(provider?.location?.lng);

        if (!mapRef.current || ticketLat == null || ticketLng == null) {
            return;
        }

        const now = Date.now();
        // Skip if last fit was too recent
        if (hasFittedRouteRef.current && now - lastFitTimestampRef.current < 3000) {
            return;
        }

        lastFitTimestampRef.current = now;

        const points = routeCoords.length > 2 
            ? routeCoords 
            : [{ latitude: ticketLat, longitude: ticketLng }];
            
        if (routeCoords.length === 0 && providerLat != null && providerLng != null) {
            points.push({ latitude: providerLat, longitude: providerLng });
        }

        if (points.length === 1) {
            mapRef.current.animateToRegion({
                latitude: ticketLat,
                longitude: ticketLng,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
            }, 1000);
        } else {
            // Include a bit more padding for the route
            mapRef.current.fitToCoordinates(points, {
                edgePadding: { top: 80, right: 60, bottom: 60, left: 60 },
                animated: true,
            });
        }

        hasFittedRouteRef.current = true;
    }, [ticket?.lat, ticket?.lng, provider?.location?.lat, provider?.location?.lng, routeCoords, ticket?.status]);

    // OSRM Routing logic
    useEffect(() => {
        const ticketLat = toFiniteNumber(ticket?.lat);
        const ticketLng = toFiniteNumber(ticket?.lng);
        const providerLat = toFiniteNumber(provider?.location?.lat);
        const providerLng = toFiniteNumber(provider?.location?.lng);

        if (ticketLat == null || ticketLng == null || providerLat == null || providerLng == null) {
            setRouteCoords([]);
            return;
        }

        const getRoute = async () => {
            try {
                // Free OSRM Public API
                const url = `https://router.project-osrm.org/route/v1/driving/${ticketLng},${ticketLat};${providerLng},${providerLat}?overview=full&geometries=geojson`;
                const response = await fetch(url);
                const data = await response.json();

                if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                    const coords = data.routes[0].geometry.coordinates.map((c: [number, number]) => ({
                        latitude: c[1],
                        longitude: c[0]
                    }));
                    setRouteCoords(coords);
                } else {
                    // Fallback to straight line
                    setRouteCoords([
                        { latitude: ticketLat, longitude: ticketLng },
                        { latitude: providerLat, longitude: providerLng }
                    ]);
                }
            } catch (err) {
                console.warn('Error fetching road route:', err);
                setRouteCoords([
                    { latitude: ticketLat, longitude: ticketLng },
                    { latitude: providerLat, longitude: providerLng }
                ]);
            }
        };

        const timer = setTimeout(getRoute, 500); // Debounce route requests
        return () => clearTimeout(timer);
    }, [ticket?.lat, ticket?.lng, provider?.location?.lat, provider?.location?.lng]);



    if (loading) {
        return (
            <SafeAreaView style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
                <Text style={styles.loadingText}>Conectando ao prestador...</Text>
            </SafeAreaView>
        );
    }

    if (fetchError || !ticket) {
        return (
            <SafeAreaView style={[styles.container, styles.centerContent]}>
                <Text style={styles.errorText}>{fetchError || 'Ticket não encontrado'}</Text>
                <Button title="Voltar para o Início" variant="ghost" onPress={() => router.replace('/(tabs)/home')} />
            </SafeAreaView>
        );
    }

    const showProviderCard = ['confirmed', 'en_route', 'arrived', 'quote_provided', 'quote_accepted', 'done'].includes(ticket.status);
    const statusConfig = (ticket.status === 'quote_accepted' && ticket.done_provider_at)
        ? {
            label: 'Prestador finalizou',
            icon: CheckCircle,
            color: Colors.light.success,
            bg: Colors.light.successBackground,
        }
        : (STATUS_CONFIG[ticket.status] || STATUS_CONFIG.finding);
    const StatusIcon = statusConfig.icon;
    const shortId = ticket.id.split('-')[0].toUpperCase();

    return (
        <View style={styles.container}>
            <SuccessModal 
                visible={showModal} 
                onClose={() => {
                    setShowModal(false);
                    // Clear the param from the URL to prevent re-shows
                    router.setParams({ showSuccess: undefined });
                }} 
                providerName={provider?.full_name || 'Seu prestador'} 
            />

            {/* Content Area */}
            <ScrollView 
                style={styles.contentScroll} 
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* Map Section - Hide if finished or canceled */}
                {!['done', 'canceled', 'declined', 'expired'].includes(ticket.status) && (
                    <View style={styles.mapContainer}>
                        <MapView
                            ref={mapRef}
                            style={styles.map}
                            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                            customMapStyle={Platform.OS === 'android' ? BRANDED_MAP_STYLE : undefined}
                            userInterfaceStyle="light"
                            scrollEnabled={true}
                            zoomEnabled={true}
                            initialRegion={ticket.lat != null && ticket.lng != null ? {
                                latitude: ticket.lat,
                                longitude: ticket.lng,
                                latitudeDelta: 0.05,
                                longitudeDelta: 0.05,
                            } : undefined}
                        >


                {ticket.lat != null && ticket.lng != null && !isNaN(ticket.lat) && !isNaN(ticket.lng) && (
                    <Marker
                        coordinate={{ latitude: ticket.lat, longitude: ticket.lng }}
                        title="Sua Localização"
                        tracksViewChanges={false}
                        anchor={{ x: 0.5, y: 1 }}
                    >
                        <Image
                            source={require('../../../assets/images/wavinghuman.png')}
                            style={styles.userMarkerImage}
                            resizeMode="contain"
                        />
                    </Marker>
                )}

                {provider?.location && (
                    <Marker
                        coordinate={{ latitude: provider.location.lat, longitude: provider.location.lng }}
                        title={provider.full_name}
                        tracksViewChanges={false}
                        anchor={{ x: 0.5, y: 0.5 }}
                    >
                        <View style={styles.providerMarkerAvatarWrap}>
                            <View style={styles.providerMarkerAvatar}>
                                {provider.avatar_url ? (
                                    <Image
                                        source={{ uri: provider.avatar_url }}
                                        style={styles.providerMarkerImageFull}
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <View style={styles.providerMarkerPlaceholder}>
                                        <Image
                                            source={getCategoryImage(provider.service_category ?? ticket.category)}
                                            style={styles.providerMarkerImageSmall}
                                            resizeMode="contain"
                                        />
                                    </View>
                                )}
                            </View>
                            {/* Category Badge */}
                            <View style={styles.providerMarkerBadge}>
                                <Image
                                    source={getCategoryImage(provider.service_category ?? ticket.category)}
                                    style={styles.providerMarkerBadgeIcon}
                                    resizeMode="contain"
                                />
                            </View>
                        </View>
                    </Marker>
                )}



                {routeCoords.length > 1 &&
                    <Polyline
                        coordinates={routeCoords}
                        strokeColors={routeGradientColors}
                        strokeWidth={5}
                        lineDashPattern={[0]}
                    />
                }
                {routeCoords.length > 1 &&
                    <Polyline
                        coordinates={routeCoords}
                        strokeColor="rgba(255,255,255,0.65)"
                        strokeWidth={2}
                        lineDashPattern={[6, 14]}
                        lineDashPhase={dashPhase}
                    />
                }


                    </MapView>

                </View>
            )}


                {/* Status & ID Header */}
                <View style={styles.detailsHeader}>
                    <View>
                        <Text style={styles.detailsOrderNumber}>Pedido #{shortId}</Text>
                        <Text style={styles.detailsCategory}>{ticket.category}</Text>
                    </View>
                    <View style={[styles.detailsStatusBadge, { backgroundColor: statusConfig.color + '15' }]}>
                        <StatusIcon size={14} color={statusConfig.color} />
                        <Text style={[styles.detailsStatusText, { color: statusConfig.color }]}>
                            {statusConfig.label}
                        </Text>
                    </View>
                </View>

                {/* Search Phase Action Card */}
                {(ticket.status === 'finding' || ticket.status === 'offered') && (
                    <Card style={styles.infoCard}>
                        <View style={{ paddingVertical: 4 }}>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 }}>
                                {ticket.status === 'offered' ? 'Propostas disponíveis!' : 'Buscando profissionais...'}
                            </Text>
                            <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 14, lineHeight: 20 }}>
                                {ticket.status === 'offered'
                                    ? 'Prestadores enviaram propostas para o seu atendimento. Abra a tela de ofertas para escolher.'
                                    : 'A busca está ativa no sistema. Você pode acompanhar as ofertas em tempo real ou cancelar o pedido.'}
                            </Text>
                            <Button
                                title={ticket.status === 'offered' ? 'Ver Ofertas' : 'Acompanhar Busca'}
                                onPress={() => router.push({ pathname: '/request/new/match', params: { requestId: ticket.id } } as any)}
                                style={{ marginBottom: 8 }}
                            />
                            <TouchableOpacity
                                style={{ paddingVertical: 8, alignItems: 'center' }}
                                onPress={handleCancelTicket}
                                activeOpacity={0.7}
                            >
                                <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 14 }}>Cancelar pedido</Text>
                            </TouchableOpacity>
                        </View>
                    </Card>
                )}

                {/* Provider Section */}
                {showProviderCard && provider && (
                    <Card style={styles.infoCard}>
                        <View style={styles.providerRowDetail}>
                            <View style={styles.providerImageWrapDetail}>
                                <Image 
                                    source={{ uri: provider.avatar_url || 'https://via.placeholder.com/100' }} 
                                    style={styles.providerImageDetail} 
                                />
                                <View style={styles.ratingBadgeDetail}>
                                    <Text style={styles.ratingTextDetail}>
                                        ★ {provider.rating != null && provider.rating > 0 ? provider.rating.toFixed(1) : '—'}
                                    </Text>
                                </View>
                            </View>
                            
                            <View style={styles.providerInfoDetail}>
                                <Text style={styles.providerNameDetail}>{provider.full_name}</Text>
                                {ticket.status === 'confirmed' && (
                                    <View style={styles.etaRowDetail}>
                                        <Clock size={14} color={Colors.light.primary} />
                                        <Text style={styles.etaTextDetail}>
                                            {getTrackingSubtitle('confirmed', approximateDistanceStr, estimatedTime)}
                                        </Text>
                                    </View>
                                )}
                                {ticket.status === 'en_route' && (
                                    <View style={styles.etaRowDetail}>
                                        <Navigation size={14} color={Colors.light.primary} />
                                        <Text style={styles.etaTextDetail}>
                                            {getTrackingSubtitle('en_route', approximateDistanceStr, estimatedTime)}
                                        </Text>
                                    </View>
                                )}
                                {ticket.status === 'arrived' && (
                                    <View style={styles.etaRowDetail}>
                                        <MapPin size={14} color="#0284C7" />
                                        <Text style={[styles.etaTextDetail, { color: '#0284C7' }]}>Prestador no local</Text>
                                    </View>
                                )}
                                {ticket.status === 'quote_provided' && (
                                    <View style={styles.etaRowDetail}>
                                        <FileText size={14} color="#D97706" />
                                        <Text style={[styles.etaTextDetail, { color: '#D97706' }]}>Orçamento enviado</Text>
                                    </View>
                                )}
                                {ticket.status === 'quote_accepted' && (
                                    <View style={styles.etaRowDetail}>
                                        {ticket.done_provider_at ? (
                                            <>
                                                <CheckCircle size={14} color={Colors.light.success} />
                                                <Text style={[styles.etaTextDetail, { color: Colors.light.success }]}>
                                                    Prestador finalizou — confirme a conclusão
                                                </Text>
                                            </>
                                        ) : (
                                            <>
                                                <Wrench size={14} color="#10B981" />
                                                <Text style={[styles.etaTextDetail, { color: '#10B981' }]}>
                                                    Serviço em execução
                                                </Text>
                                            </>
                                        )}
                                    </View>
                                )}
                                {ticket.status === 'done' && (
                                    <View style={styles.etaRowDetail}>
                                        <CheckCircle size={14} color={Colors.light.success} />
                                        <Text style={[styles.etaTextDetail, { color: Colors.light.success }]}>
                                            Serviço concluído
                                        </Text>
                                    </View>
                                )}
                            </View>

                            <TouchableOpacity 
                                style={styles.callButtonDetail}
                                onPress={() => { /* Logic to call */ }}
                            >
                                <Phone size={22} color={Colors.light.primary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.actionRowDetail}>
                            <Button 
                                title="Abrir Chat" 
                                leftIcon={<MessageSquare size={20} color="#fff" />}
                                style={styles.chatButtonDetail}
                                onPress={() => router.push(`/chat/${ticket.id}`)}
                            />
                        </View>
                    </Card>
                )}

                {/* Quote Approval Card (when status === 'quote_provided') */}
                {ticket.status === 'quote_provided' && (
                    <Card style={[styles.infoCard, styles.quoteCard]}>
                        <View style={styles.sectionHeader}>
                            <FileText size={20} color="#D97706" style={{ marginRight: 8 }} />
                            <Text style={[styles.sectionTitle, { color: '#92400E' }]}>Orçamento do Serviço</Text>
                        </View>
                        <Text style={styles.quoteDesc}>
                            O profissional avaliou o problema no local e informou o valor para realização do reparo:
                        </Text>
                        <View style={styles.quotePriceBox}>
                            <Text style={styles.quotePriceLabel}>Valor total do serviço</Text>
                            <Text style={styles.quotePriceValue}>
                                R$ {(ticket.service_quote || 0).toFixed(2).replace('.', ',')}
                            </Text>
                        </View>

                        <Text style={styles.paymentMethodPrompt}>Escolha como pagar o serviço no local:</Text>
                        <View style={styles.quoteMethodRow}>
                            <TouchableOpacity
                                style={[styles.quoteMethodChip, quotePaymentMethod === 'pix' && styles.quoteMethodChipActive]}
                                onPress={() => setQuotePaymentMethod('pix')}
                                activeOpacity={0.8}
                            >
                                <Banknote size={16} color={quotePaymentMethod === 'pix' ? '#fff' : '#4B5563'} />
                                <Text style={[styles.quoteMethodChipText, quotePaymentMethod === 'pix' && styles.quoteMethodChipTextActive]}>
                                    Pix
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.quoteMethodChip, quotePaymentMethod === 'credit_card' && styles.quoteMethodChipActive]}
                                onPress={() => setQuotePaymentMethod('credit_card')}
                                activeOpacity={0.8}
                            >
                                <CreditCard size={16} color={quotePaymentMethod === 'credit_card' ? '#fff' : '#4B5563'} />
                                <Text style={[styles.quoteMethodChipText, quotePaymentMethod === 'credit_card' && styles.quoteMethodChipTextActive]}>
                                    Cartão
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.quoteMethodChip, quotePaymentMethod === 'cash' && styles.quoteMethodChipActive]}
                                onPress={() => setQuotePaymentMethod('cash')}
                                activeOpacity={0.8}
                            >
                                <Banknote size={16} color={quotePaymentMethod === 'cash' ? '#fff' : '#4B5563'} />
                                <Text style={[styles.quoteMethodChipText, quotePaymentMethod === 'cash' && styles.quoteMethodChipTextActive]}>
                                    Dinheiro
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[styles.acceptQuoteBtn, acceptQuoteLoading && { opacity: 0.6 }]}
                            onPress={handleAcceptQuote}
                            disabled={acceptQuoteLoading}
                            activeOpacity={0.85}
                        >
                            {acceptQuoteLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <CheckCircle size={18} color="#fff" />
                                    <Text style={styles.acceptQuoteBtnText}>Aprovar Orçamento</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </Card>
                )}

                {/* Service in Progress (status === 'quote_accepted') */}
                {ticket.status === 'quote_accepted' && !ticket.done_provider_at && (
                    <Card style={[styles.infoCard, styles.inProgressCard]}>
                        <View style={styles.sectionHeader}>
                            <Wrench size={18} color="#059669" style={{ marginRight: 8 }} />
                            <Text style={[styles.sectionTitle, { color: '#065F46' }]}>Serviço em Execução</Text>
                        </View>
                        <Text style={styles.completionDesc}>
                            Orçamento aprovado no valor de R$ {(ticket.service_quote || 0).toFixed(2).replace('.', ',')}. O profissional está trabalhando no reparo.
                        </Text>
                    </Card>
                )}

                {/* Completion Confirmation */}
                {ticket.status === 'quote_accepted' && ticket.done_provider_at && !ticket.done_client_at && (
                    <Card style={[styles.infoCard, styles.completionCard]}>
                        <View style={styles.completionHeader}>
                            <CheckCircle size={20} color={Colors.light.success} />
                            <Text style={styles.completionTitle}>Prestador finalizou o serviço</Text>
                        </View>
                        <Text style={styles.completionDesc}>
                            {provider?.full_name || 'O prestador'} informou que o serviço foi concluído. Confirme para finalizar o pedido.
                        </Text>
                        <TouchableOpacity
                            style={styles.confirmDoneBtn}
                            onPress={handleConfirmDone}
                            disabled={confirmLoading}
                            activeOpacity={0.8}
                        >
                            {confirmLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <CheckCircle size={18} color="#fff" />
                                    <Text style={styles.confirmDoneBtnText}>Confirmar conclusão</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </Card>
                )}

                {/* Waiting for provider confirmation */}
                {ticket.status === 'quote_accepted' && ticket.done_client_at && !ticket.done_provider_at && (
                    <Card style={[styles.infoCard, styles.waitingCard]}>
                        <View style={styles.completionHeader}>
                            <Clock size={18} color={Colors.light.primary} />
                            <Text style={styles.waitingTitle}>Aguardando o prestador confirmar</Text>
                        </View>
                        <Text style={styles.completionDesc}>
                            Você já confirmou a conclusão. Aguarde {provider?.full_name || 'o prestador'} confirmar também.
                        </Text>
                    </Card>
                )}

                {/* Rate provider after done */}
                {ticket.status === 'done' && provider && (
                    <Card style={styles.infoCard}>
                        <View style={styles.completionHeader}>
                            <Star size={18} color="#F59E0B" />
                            <Text style={styles.completionTitle}>Avalie o serviço</Text>
                        </View>
                        <Text style={styles.completionDesc}>
                            Como foi o serviço de {provider.full_name}?
                        </Text>
                        <TouchableOpacity
                            style={styles.rateBtn}
                            onPress={() => { setRatingValue(0); setRatingComment(''); setRatingVisible(true); }}
                            activeOpacity={0.8}
                        >
                            <Star size={18} color="#fff" />
                            <Text style={styles.rateBtnText}>Avaliar prestador</Text>
                        </TouchableOpacity>
                    </Card>
                )}

                {/* AI Diagnosis Section */}
                {ticket.ai_result_json && (ticket.ai_result_json.problem_guess || ticket.ai_result_json.summary_for_provider) && (
                    <Card style={styles.infoCard}>
                        <View style={styles.sectionHeader}>
                            <BadgeCheck size={18} color={Colors.light.primary} style={{ marginRight: 8 }} />
                            <Text style={styles.sectionTitle}>Análise do Sistema</Text>
                        </View>
                        <Text style={styles.aiProblemGuess}>{ticket.ai_result_json.problem_guess || "Problema Identificado"}</Text>
                        <Text style={styles.aiSummary}>{ticket.ai_result_json.summary_for_provider}</Text>
                    </Card>
                )}

                {/* Question Answers Section */}
                {ticket.answers_json && Object.keys(ticket.answers_json).length > 0 && (
                    <Card style={styles.infoCard}>
                        <View style={styles.sectionHeader}>
                            <History size={18} color="#6B7280" style={{ marginRight: 8 }} />
                            <Text style={styles.sectionTitle}>Respostas do Checkout</Text>
                        </View>
                        <View style={{ gap: 8 }}>
                            {Object.entries(ticket.answers_json).map(([key, val]: [string, any]) => (
                                <View key={key} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', marginRight: 8 }} />
                                    <Text style={{ fontSize: 13, color: '#4B5563', textTransform: 'capitalize' }}>
                                        {key.replace(/_/g, ' ')}: <Text style={{ fontWeight: '700' }}>{val}</Text>
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </Card>
                )}


                {/* Description Section */}
                {ticket.user_text && (
                    <Card style={styles.infoCard}>
                        <Text style={styles.sectionTitle}>Sua Descrição</Text>
                        <Text style={styles.descriptionText}>{ticket.user_text}</Text>
                    </Card>
                )}

                {/* Address Section */}
                <Card style={styles.infoCard}>
                    <View style={styles.sectionHeader}>
                        <MapPin size={18} color="#6B7280" style={{ marginRight: 8 }} />
                        <Text style={styles.sectionTitle}>Endereço de Atendimento</Text>
                    </View>
                    <Text style={styles.addressText}>{ticket.address}</Text>
                </Card>


                {/* Security Section */}
                <View style={styles.securityNoticeDetail}>
                    <Shield size={14} color="#9CA3AF" />
                    <Text style={styles.securityTextDetail}>Pagamento combinado e realizado diretamente com o profissional no local.</Text>
                </View>

                {/* Bottom Spacer for Scroll */}
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Rating Modal */}
            <Modal
                visible={ratingVisible}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    setRatingVisible(false);
                    router.replace('/(tabs)/home');
                }}
            >
                <KeyboardAvoidingView
                    style={styles.keyboardAvoidingView}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <Pressable
                        style={styles.modalOverlay}
                        onPress={Keyboard.dismiss}
                        accessible={false}
                    >
                        <View
                            style={styles.modalContent}
                            onStartShouldSetResponder={() => true}
                        >
                            <ScrollView
                                contentContainerStyle={styles.modalScrollContent}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                                bounces={false}
                            >
                                <Text style={styles.modalTitle}>Avaliar prestador</Text>
                                <Text style={styles.modalSubtitle}>Como foi o serviço de {provider?.full_name}?</Text>

                                <View style={styles.starsRow}>
                                    {[1, 2, 3, 4, 5].map((v) => (
                                        <TouchableOpacity key={v} onPress={() => setRatingValue(v)} activeOpacity={0.7}>
                                            <Star
                                                size={36}
                                                color="#F59E0B"
                                                fill={v <= ratingValue ? '#F59E0B' : 'transparent'}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <TextInput
                                    style={styles.commentInput}
                                    placeholder="Comentário (opcional)"
                                    placeholderTextColor="#9CA3AF"
                                    value={ratingComment}
                                    onChangeText={setRatingComment}
                                    multiline
                                    maxLength={300}
                                />

                                <TouchableOpacity
                                    style={[styles.modalSubmitBtn, ratingValue === 0 && styles.modalSubmitBtnDisabled]}
                                    onPress={handleSubmitRating}
                                    disabled={ratingValue === 0 || ratingLoading}
                                    activeOpacity={0.8}
                                >
                                    {ratingLoading ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.modalSubmitBtnText}>Enviar avaliação</Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => {
                                        setRatingVisible(false);
                                        router.replace('/(tabs)/home');
                                    }}
                                    style={styles.modalSkipBtn}
                                >
                                    <Text style={styles.modalSkipText}>Pular</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </Pressable>
                </KeyboardAvoidingView>
            </Modal>

            {/* Sticky Top Header (Back/Close) */}
            <SafeAreaView style={styles.stickyHeader} edges={['top']}>
                <TouchableOpacity onPress={() => router.replace('/(tabs)/home')} style={styles.backButtonSticky}>
                    <X size={24} color="#1F2937" />
                </TouchableOpacity>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    stickyHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    backButtonSticky: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#fff',
        marginLeft: 16,
        marginTop: 8,
        justifyContent: 'center',
        alignItems: 'center',
        ...Layout.shadows.medium,
    },
    contentScroll: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: 40,
    },
    mapContainer: {
        height: 220,

        width: '100%',
        overflow: 'hidden',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    detailsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    detailsOrderNumber: {
        fontSize: 20,
        fontWeight: '900',
        color: '#111827',
    },
    detailsCategory: {
        fontSize: 15,
        color: '#6B7280',
        marginTop: 2,
        fontWeight: '600',
    },
    detailsStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    detailsStatusText: {
        fontSize: 13,
        fontWeight: '800',
        marginLeft: 6,
    },
    infoCard: {
        marginHorizontal: 16,
        marginTop: 16,
        padding: 16,
        borderRadius: 20,
        backgroundColor: '#fff',
        ...Layout.shadows.small,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#374151',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    aiProblemGuess: {
        fontSize: 17,
        fontWeight: '800',
        color: Colors.light.primary,
        marginBottom: 8,
    },
    aiSummary: {
        fontSize: 15,
        lineHeight: 22,
        color: '#4B5563',
    },
    descriptionText: {
        fontSize: 15,
        lineHeight: 22,
        color: '#4B5563',
    },
    addressText: {
        fontSize: 15,
        lineHeight: 22,
        color: '#1F2937',
        fontWeight: '600',
    },
    referenceText: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 4,
        fontStyle: 'italic',
    },
    providerRowDetail: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    providerImageWrapDetail: {
        position: 'relative',
    },
    providerImageDetail: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#F3F4F6',
    },
    ratingBadgeDetail: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        backgroundColor: '#fff',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        ...Layout.shadows.small,
        borderWidth: 1,
        borderColor: '#FEF3C7',
    },
    ratingTextDetail: {
        fontSize: 10,
        fontWeight: '800',
        color: '#D97706',
    },
    providerInfoDetail: {
        flex: 1,
        marginLeft: 16,
        marginRight: 8,
    },
    providerNameDetail: {
        fontSize: 17,
        fontWeight: '800',
        color: '#111827',
    },
    etaRowDetail: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: 4,
    },
    etaTextDetail: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.light.primary,
        marginLeft: 6,
        flexShrink: 1,
    },
    callButtonDetail: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionRowDetail: {
        marginTop: 20,
    },
    chatButtonDetail: {
        height: 50,
        backgroundColor: '#111827',
        borderRadius: 12,
    },
    securityNoticeDetail: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 24,
        gap: 8,
    },
    securityTextDetail: {
        fontSize: 12,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '500',
    },
    errorText: {

        fontSize: 16,
        color: '#EF4444',
        marginBottom: 20,
        textAlign: 'center',
    },

    userMarker: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    userMarkerInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#3B82F6',
        borderWidth: 2,
        borderColor: '#fff',
    },
    userMarkerImage: {
        width: 44,
        height: 44,
    },
    providerMarkerAvatarWrap: {
        width: 60,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    providerMarkerAvatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: Colors.light.primary,
        overflow: 'hidden',
        ...Layout.shadows.medium,
    },
    providerMarkerImageFull: {
        width: '100%',
        height: '100%',
    },
    providerMarkerPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: Colors.light.primary + '10',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
    },
    providerMarkerImageSmall: {
        width: 24,
        height: 24,
        tintColor: Colors.light.primary,
    },
    providerMarkerBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.light.primary,
        borderWidth: 1.5,
        borderColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
        ...Layout.shadows.small,
    },
    providerMarkerBadgeIcon: {
        width: '100%',
        height: '100%',
        tintColor: '#fff',
    },
    // Completion flow
    completionCard: {
        borderColor: Colors.light.success + '30',
        borderWidth: 1.5,
    },
    waitingCard: {
        borderColor: Colors.light.primary + '30',
        borderWidth: 1.5,
        backgroundColor: '#FEFCE8',
    },
    completionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    completionTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
    },
    waitingTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: Colors.light.primary,
    },
    completionDesc: {
        fontSize: 14,
        lineHeight: 20,
        color: '#6B7280',
        marginBottom: 12,
    },
    confirmDoneBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: Colors.light.success,
        height: 48,
        borderRadius: 12,
    },
    confirmDoneBtnText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#fff',
    },
    rateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#F59E0B',
        height: 48,
        borderRadius: 12,
    },
    rateBtnText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#fff',
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    // Rating modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 24,
        width: '100%',
        maxWidth: 400,
        maxHeight: '85%',
        overflow: 'hidden',
    },
    modalScrollContent: {
        padding: 28,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#111827',
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 20,
        textAlign: 'center',
    },
    starsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    commentInput: {
        width: '100%',
        minHeight: 80,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        color: '#1F2937',
        textAlignVertical: 'top',
        marginBottom: 16,
    },
    modalSubmitBtn: {
        width: '100%',
        height: 48,
        borderRadius: 12,
        backgroundColor: '#F59E0B',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalSubmitBtnDisabled: {
        opacity: 0.4,
    },
    modalSubmitBtnText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#fff',
    },
    modalSkipBtn: {
        marginTop: 12,
        paddingVertical: 8,
    },
    modalSkipText: {
        fontSize: 14,
        color: '#9CA3AF',
        fontWeight: '600',
    },
    // Quote and In Progress styles
    quoteCard: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A',
        borderWidth: 1,
    },
    quoteDesc: {
        fontSize: 14,
        color: '#78350F',
        lineHeight: 20,
        marginBottom: 12,
    },
    quotePriceBox: {
        backgroundColor: '#FEF3C7',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 14,
    },
    quotePriceLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#92400E',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    quotePriceValue: {
        fontSize: 26,
        fontWeight: '900',
        color: '#78350F',
    },
    paymentMethodPrompt: {
        fontSize: 13,
        fontWeight: '600',
        color: '#92400E',
        marginBottom: 8,
    },
    quoteMethodRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    quoteMethodChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    quoteMethodChipActive: {
        backgroundColor: '#D97706',
        borderColor: '#D97706',
    },
    quoteMethodChipText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#4B5563',
    },
    quoteMethodChipTextActive: {
        color: '#fff',
    },
    acceptQuoteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#D97706',
        height: 48,
        borderRadius: 12,
    },
    acceptQuoteBtnText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#fff',
    },
    inProgressCard: {
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
        borderWidth: 1,
    },
});
