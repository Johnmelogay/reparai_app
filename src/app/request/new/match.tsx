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
import { QUESTION_SETS } from '@/services/questionsData';
import { supabase } from '@/services/supabase';
import { useRouter } from 'expo-router';
import { CheckCircle, MapPin } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Easing, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

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
        aiResult
    } = useRequest();

    const questionSet = QUESTION_SETS[category || 'electronics'] || QUESTION_SETS['electronics'];

    // Animations
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const cardSlideAnim = useRef(new Animated.Value(height)).current; // Start off-screen
    const [statusText, setStatusText] = useState("Contatando profissionais próximos...");

    useEffect(() => {
        if (status === 'NEW' || status === 'OFFERED') {
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

        if (status === 'NEW' || status === 'OFFERED') {
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
        if ((status === 'ACCEPTED' || status === 'PAID' || status === 'EN_ROUTE') && assignedProvider) {
            // Slide up card
            Animated.spring(cardSlideAnim, {
                toValue: 0,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }).start();
        }
    }, [status, assignedProvider]);

    const handleOpenChat = () => {
        if (assignedProvider) {
            router.push(`/chat/${assignedProvider.id}`);
        }
    };

    const handleCancel = () => {
        cancelRequest();
        router.push('/(tabs)/home');
    };

    return (
        <View style={styles.container}>
            {/* Background Map */}
            <MapView
                style={StyleSheet.absoluteFill}
                provider={PROVIDER_GOOGLE}
                customMapStyle={BRANDED_MAP_STYLE}
                initialRegion={INITIAL_REGION}
                userInterfaceStyle="light"
            >
                {/* User Marker */}
                <Marker
                    coordinate={{
                        latitude: currentTicket?.coordinates?.latitude || INITIAL_REGION.latitude,
                        longitude: currentTicket?.coordinates?.longitude || INITIAL_REGION.longitude
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

                {/* Show Provider Marker only when found */}
                {assignedProvider && (
                    <Marker coordinate={{ latitude: -8.762, longitude: -63.902 }}>
                        <Image source={{ uri: assignedProvider.image }} style={styles.mapAvatar} />
                    </Marker>
                )}
            </MapView>

            {/* Floating Summary Status (C9) */}
            {status === 'NEW' && (
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
            {(status === 'NEW' || status === 'OFFERED') && (
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
            {(status === 'ACCEPTED' || status === 'PAID' || status === 'EN_ROUTE') && (
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
                                {status === 'ACCEPTED' ? 'Aguardando Pagamento' :
                                    status === 'PAID' ? 'Pedido Confirmado' :
                                        'Profissional a caminho'}
                            </Text>
                            {status === 'EN_ROUTE' && eta && (
                                <Text style={styles.etaText}>Chegada estimada: {eta} minutos</Text>
                            )}
                        </View>
                    </View>

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
                        {status === 'ACCEPTED' && (
                            <View style={{ gap: 12 }}>
                                <View style={styles.feeInfo}>
                                    <Text style={styles.feeLabel}>Taxa de deslocamento</Text>
                                    <Text style={styles.feeValue}>R$ 15,00</Text>
                                </View>
                                <Button
                                    title="Confirmar e Pagar"
                                    onPress={() => {
                                        setStatus('PAID');
                                    }}
                                    style={{ backgroundColor: Colors.light.primary }}
                                />
                                <TouchableOpacity
                                    onPress={() => {
                                        setAssignedProvider(null);
                                        setStatus('NEW');
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
