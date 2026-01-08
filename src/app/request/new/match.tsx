import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { BRANDED_MAP_STYLE } from '@/constants/MapStyles';
import { useRequest } from '@/context/RequestContext';
import { supabase } from '@/services/supabase';
import { useRouter } from 'expo-router';
import { CheckCircle, MapPin } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, StyleSheet, Text, View } from 'react-native';
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
    const { status, setStatus, assignedProvider, setAssignedProvider, cancelRequest, eta, currentTicket } = useRequest();

    // Animations
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const cardSlideAnim = useRef(new Animated.Value(height)).current; // Start off-screen
    const [statusText, setStatusText] = useState("Contatando profissionais próximos...");

    useEffect(() => {
        // Pulse Animation active during NEW status
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.ease),
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0,
                    duration: 0,
                    useNativeDriver: true,
                })
            ])
        ).start();
    }, []);

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
                <Marker coordinate={{ latitude: INITIAL_REGION.latitude, longitude: INITIAL_REGION.longitude }}>
                    <View style={styles.userMarkerOut}>
                        <View style={styles.userMarkerIn} />
                    </View>
                </Marker>

                {/* Show Provider Marker only when found */}
                {assignedProvider && (
                    <Marker coordinate={{ latitude: -8.762, longitude: -63.902 }}>
                        <Image source={{ uri: assignedProvider.image }} style={styles.mapAvatar} />
                    </Marker>
                )}
            </MapView>

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
                            <Button
                                title="Pagar Taxa do Ticket (R$ 15,00)"
                                onPress={() => {
                                    // Navigate to payment
                                    setStatus('PAID');
                                }}
                                style={{ backgroundColor: Colors.light.primary }}
                            />
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
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(253, 123, 5, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    userMarkerIn: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.light.primary,
        borderWidth: 2,
        borderColor: '#fff',
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
});
