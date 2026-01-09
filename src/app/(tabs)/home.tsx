import { usePartners } from '@/hooks/usePartners';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
    ChevronRight,
    ClipboardList,
    Locate,
    Map,
    MapPin,
    Star,
    Wrench,
    X,
    Zap
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Image, Platform, Animated as RNAnimated, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Reanimated, { Extrapolation, FadeIn, FadeOut, interpolate, useAnimatedProps, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import AddressSelectionModal from '@/components/AddressSelectionModal';
import { ServiceCard } from '@/components/ui/ServiceCard';
import { Colors } from '@/constants/Colors';
import { useLocation } from '@/context/LocationContext';
import { useRequest } from '@/context/RequestContext';

// ...



const { width, height } = Dimensions.get('window');

// Static asset mapping to ensure bundler picks them up reliably
const CATEGORY_IMAGES: Record<string, any> = {
    // 3D Icons
    auto: require('../../../assets/images/car_tire_car_services.png'),
    electronics: require('../../../assets/images/electric_plug.png'), // Fallback
    hvac: require('../../../assets/images/ac_unit.png'),
    plumbing: require('../../../assets/images/plumber.png'),
    gardening: require('../../../assets/images/gardening.png'),
    cleaning: require('../../../assets/images/cleaning.png'),
    beauty: require('../../../assets/images/nail_polish.png'),
    carpentry: require('../../../assets/images/wrench_tool.png'), // Fallback
    pest_control: require('../../../assets/images/pest_control.png'),
    handyman: require('../../../assets/images/wrench_tool.png'),
    electrical: require('../../../assets/images/electric_plug.png'),
    default: require('../../../assets/images/wrench_tool.png'),
};

// Force a clean, light map look (works on Android via custom style; iOS also supports userInterfaceStyle)


// Skeleton Card Component
const SkeletonProviderCard = () => {
    // Simple pulse animation could be added here later
    const [opacity] = useState(new RNAnimated.Value(0.3));

    React.useEffect(() => {
        RNAnimated.loop(
            RNAnimated.sequence([
                RNAnimated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
                RNAnimated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    return (
        <RNAnimated.View style={[styles.providerCard, { opacity, borderColor: 'transparent' }]}>
            <View style={[styles.providerImage, { backgroundColor: '#E2E8F0' }]} />
            <View style={styles.providerInfo}>
                <View style={[styles.rowBetween, { marginBottom: 10 }]}>
                    <View style={{ width: '60%', height: 16, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
                    <View style={{ width: 40, height: 16, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
                </View>
                <View style={{ width: '40%', height: 12, backgroundColor: '#E2E8F0', borderRadius: 4, marginBottom: 10 }} />
                <View style={{ width: '50%', height: 12, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
            </View>
        </RNAnimated.View>
    );
};

// Provider Card Component (for the Bottom Sheet list)
const ProviderCard = React.memo(function ProviderCard({
    provider,
    onPress,
}: {
    provider: any;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            style={styles.providerCard}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Image source={{ uri: provider.image }} style={styles.providerImage} />

            <View style={styles.providerInfo}>
                <View style={styles.rowBetween}>
                    <View style={styles.providerNameRow}>
                        <Text style={styles.providerName} numberOfLines={1}>
                            {provider.name}
                        </Text>
                        {provider.badges?.includes('verified') && (
                            <View style={styles.verifiedIndicator}>
                                <Text style={styles.verifiedText}>✓</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.ratingBadge}>
                        <Star size={12} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.ratingText}>{provider.rating}</Text>
                    </View>
                </View>

                <Text style={styles.providerCategory} numberOfLines={1}>
                    {provider.category} • {provider.distance}
                </Text>

                <View style={styles.providerPriceRow}>
                    <Text style={styles.providerPrice} numberOfLines={1}>
                        Visita técnica: R$ {provider.visitPrice}
                    </Text>

                    {provider.status === 'online' && (
                        <View style={styles.onlineIndicator}>
                            <View style={styles.onlineDot} />
                            <Text style={styles.onlineText}>Online</Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
});



// Animated User Location Marker
const AnimatedUserMarker = () => {
    const pulseAnim = useSharedValue(0);

    React.useEffect(() => {
        pulseAnim.value = withRepeat(
            withTiming(1, { duration: 2400 }),
            -1,
            false
        );
    }, []);

    const rPulseStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [1, 2.5]) }],
            opacity: interpolate(pulseAnim.value, [0, 0.1, 0.8, 1], [0, 0.4, 0.2, 0]),
        };
    });

    return (
        <View style={{ alignItems: 'center', justifyContent: 'center', width: 60, height: 60 }}>
            {/* Pulsing Halo (centered; dot stays still) */}
            <View pointerEvents="none" style={styles.userMarkerHaloWrap}>
                <Reanimated.View style={[styles.userMarkerHalo, rPulseStyle]} />
            </View>

            {/* Outer White Layer */}
            <View style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 4,
            }}>
                {/* Inner Accent Dot */}
                <View style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: Colors.light.accent,
                    borderWidth: 1.5,
                    borderColor: 'rgba(255,255,255,0.2)',
                }} />
            </View>
        </View>
    );
};

// ... (styles) ...

export default function HomeScreen() {
    const router = useRouter();
    const { providers: nearbyProviders, loading, refetch } = usePartners();

    console.log('🏠 Home: Providers recebidos:', nearbyProviders?.length);

    const { location, selectedLocation, address: currentAddress, isLoading: isLoadingLocation, refreshLocation } = useLocation(); // [UPDATED]
    const mapRef = useRef<MapView>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [showInlineOptions, setShowInlineOptions] = useState(false); // [NEW]
    const [addressModalVisible, setAddressModalVisible] = useState(false);
    const [showRecenterBtn, setShowRecenterBtn] = useState(false);
    const insets = useSafeAreaInsets();

    // animation refs
    const scrollY = useRef(new RNAnimated.Value(0)).current;

    // Auto-center map on load
    const mapCentered = useRef(false);
    useEffect(() => {
        if (location && mapRef.current && !mapCentered.current) {
            console.log('📍 Auto-centering map on user location');
            mapRef.current.animateToRegion({
                latitude: location.coords.latitude - 0.006, // Offset to center user in top half
                longitude: location.coords.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
            }, 1000);
            mapCentered.current = true;
        }
    }, [location]);
    const clientName = 'João';
    // Fade out elements when sheet is at the top

    const { startDraft, status: requestStatus, category: requestCategory } = useRequest();
    const filteredProviders = nearbyProviders;
    const sheetPeek = Math.round(height * 0.52);

    // --- Bottom Sheet Logic (Reanimated) ---
    const { height: SCREEN_HEIGHT } = Dimensions.get('window');
    // Snap Points
    const TOP_SNAP = -SCREEN_HEIGHT + 100; // Full screen usage (a bit of padding top)
    const BOTTOM_SNAP = -SCREEN_HEIGHT * 0.45; // Initial Peeking height

    const translateY = useSharedValue(BOTTOM_SNAP);
    const context = useSharedValue({ y: 0, gestureOffset: -1 });
    const scrollOffset = useSharedValue(0);



    // Scroll handler for nested scroll
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollOffset.value = event.contentOffset.y;
        },
    });

    // Connect ScrollView's native gesture to the sheet pan for proper handoff
    const scrollGesture = Gesture.Native();

    const panGesture = Gesture.Pan()
        .onStart(() => {
            // gestureOffset === -1 means "this gesture did not take control of the sheet"
            context.value = { y: translateY.value, gestureOffset: -1 };
        })
        .onUpdate((event) => {
            const isAtScrollTop = scrollOffset.value <= 0.5;
            const isPullingDown = event.translationY > 0;
            const isPushingUp = event.translationY < 0;

            const isExpanded = translateY.value <= TOP_SNAP + 5;

            // Sheet vs Scroll handoff:
            // - When expanded: only allow pulling the sheet DOWN if the scroll content is at the very top.
            // - When not expanded: allow dragging the sheet BOTH directions (UP to expand, DOWN to collapse)
            //   even if the scroll content is not at the top.
            const shouldMoveSheet = isExpanded
                ? isAtScrollTop && isPullingDown
                : isPullingDown || isPushingUp;

            if (!shouldMoveSheet) {
                // Ensure we do not "snap" on end when we never moved the sheet in this gesture
                context.value.gestureOffset = -1;
                return;
            }

            // If we just entered the 'sheet moving' state in this gesture, lock a baseline
            if (context.value.gestureOffset === -1) {
                context.value.gestureOffset = event.translationY;
                context.value.y = translateY.value;
            }

            const deltaY = event.translationY - context.value.gestureOffset;
            let newValue = context.value.y + deltaY;

            // Limits with rubber banding
            if (newValue < TOP_SNAP) {
                newValue = TOP_SNAP + (newValue - TOP_SNAP) * 0.2;
            }
            if (newValue > BOTTOM_SNAP) {
                newValue = BOTTOM_SNAP + (newValue - BOTTOM_SNAP) * 0.2;
            }

            translateY.value = newValue;
        })
        // This is the key: let ScrollView and sheet pan cooperate
        .simultaneousWithExternalGesture(scrollGesture)
        .onEnd((event) => {
            // If we never moved the sheet during this gesture, do nothing (user was scrolling)
            const didMoveSheet = context.value.gestureOffset !== -1;
            context.value.gestureOffset = -1;
            if (!didMoveSheet) return;

            const current = translateY.value;
            const mid = (TOP_SNAP + BOTTOM_SNAP) / 2;
            const VELOCITY_THRESHOLD = 1100;

            const isFlingUp = event.velocityY < -VELOCITY_THRESHOLD;
            const isFlingDown = event.velocityY > VELOCITY_THRESHOLD;
            const isPastMidPoint = current < mid;

            if (isFlingUp) {
                translateY.value = withSpring(TOP_SNAP, { damping: 50, stiffness: 400 });
            } else if (isFlingDown) {
                translateY.value = withSpring(BOTTOM_SNAP, { damping: 50, stiffness: 400 });
            } else if (isPastMidPoint) {
                translateY.value = withSpring(TOP_SNAP, { damping: 50, stiffness: 400 });
            } else {
                translateY.value = withSpring(BOTTOM_SNAP, { damping: 50, stiffness: 400 });
            }
        });

    const edgeStartX = useSharedValue(0);
    const edgeSwipeGesture = Gesture.Pan()
        .onBegin((event) => {
            edgeStartX.value = event.x;
        })
        .activeOffsetX(20)
        .onEnd((event) => {
            const isExpanded = translateY.value <= TOP_SNAP + 50;
            if (isExpanded && edgeStartX.value < 60 && (event.translationX > 80 || event.velocityX > 700)) {
                translateY.value = withSpring(BOTTOM_SNAP, { damping: 50, stiffness: 400 });
            }
        });

    const combinedGesture = Gesture.Simultaneous(panGesture, edgeSwipeGesture);

    const rBottomSheetStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: translateY.value }],
        };
    });

    // Fade out elements when sheet is at the top
    const rElementFadeStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            translateY.value,
            [TOP_SNAP + 100, TOP_SNAP],
            [1, 0],
            Extrapolation.CLAMP
        );
        return { opacity };
    });

    const rSheetFinishStyle = useAnimatedStyle(() => {
        // Remove shadow and radius when fully expanded for seamless look
        const progress = interpolate(
            translateY.value,
            [TOP_SNAP + 50, TOP_SNAP],
            [0, 1],
            Extrapolation.CLAMP
        );

        return {
            borderTopLeftRadius: interpolate(progress, [0, 1], [28, 0]),
            borderTopRightRadius: interpolate(progress, [0, 1], [28, 0]),
            shadowOpacity: interpolate(progress, [0, 1], [0.06, 0]),
            elevation: interpolate(progress, [0, 1], [6, 0]),
        };
    });

    // Control ScrollView enablement: Disable scroll when not fully expanded to allow easy "fling to open"
    const rScrollViewProps = useAnimatedProps(() => {
        return {
            scrollEnabled: translateY.value <= TOP_SNAP + 50,
        };
    });



    // Background Opacity for "White Mode"
    const rBackgroundStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            translateY.value,
            [BOTTOM_SNAP, TOP_SNAP],
            [0, 1],
            Extrapolation.CLAMP
        );
        return {
            opacity,
            pointerEvents: opacity > 0.9 ? 'auto' : 'none',
        };
    });

    // Floating Map Button - appears when sheet is fully expanded
    const rFloatingMapBtnStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            translateY.value,
            [TOP_SNAP + 100, TOP_SNAP + 20],
            [0, 1],
            Extrapolation.CLAMP
        );
        return {
            opacity,
            pointerEvents: opacity > 0.5 ? 'auto' : 'none',
        };
    });

    // Effect to animate map to SELECTED location (primarily)
    React.useEffect(() => {
        // We only auto-animate when the SELECTED address changes
        // Or on first load if no selection persists but location is found
        if (!selectedLocation && !location) return;

        const target = selectedLocation || (location ? { latitude: location.coords.latitude, longitude: location.coords.longitude } : null);

        if (target && mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: target.latitude - 0.006, // Offset to center user in top half
                longitude: target.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
            }, 1000);
        }
    }, [selectedLocation]); // Remove 'location' from deps to prevent re-centering on every GPS update if we have a manual address

    const handleGpsShortcut = async () => {
        const newLocation = await refreshLocation(); // This only updates raw GPS state now
        setShowRecenterBtn(false);

        // Manually animate to current GPS position (without changing service address)
        if (newLocation && mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: newLocation.coords.latitude - 0.006,
                longitude: newLocation.coords.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
            }, 1000);
        }
    };

    const handleCollapseSheet = () => {
        translateY.value = withSpring(BOTTOM_SNAP, { damping: 50, stiffness: 400 });
    };

    const handleRegionChangeComplete = () => {
        // Simple logic: if user drags map, show button. 
        // Ideally we check distance from current location, but for now any manual move triggers it.
        setShowRecenterBtn(true);
    };

    // --- Configurações da Animação Inline (Ajuste aqui) ---
    const inlineProgress = useSharedValue(0);

    React.useEffect(() => {
        // Altere 'damping' para ajustar o "balanço" (menor = mais elástico)
        inlineProgress.value = withSpring(showInlineOptions ? 1 : 0, { damping: 60, stiffness: 800 });
    }, [showInlineOptions]);

    const rInlineContainerStyle = useAnimatedStyle(() => {
        const isExpanded = inlineProgress.value > 0.5;
        return {
            // Ajuste aqui a altura inicial [0] e final [1] (em pixels)
            height: interpolate(inlineProgress.value, [0, 1], [56, 334]),
            // Cor de fundo do botão (atualmente fixa no primário para manter o estilo)
            backgroundColor: Colors.light.primary,
            // Ajuste aqui o arredondamento das bordas
            borderRadius: interpolate(inlineProgress.value, [0, 1], [30, 30]),
            // Espaçamento interno horizontal (apenas quando expandido)
            padding: interpolate(inlineProgress.value, [0, 1], [0, 20]),

            // Sombra do botão
            shadowColor: Colors.light.primary,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 8,
        };
    });

    const rCtaTextStyle = useAnimatedStyle(() => {
        return {
            // Visibilidade do texto "Preciso de Reparo!"
            opacity: interpolate(inlineProgress.value, [0, 0.15], [1, 0]),
            // Movimento de subida do texto ao sumir
            transform: [{ translateY: interpolate(inlineProgress.value, [0, 0.15], [0, -10]) }],
        };
    });

    const rOptionsStyle = useAnimatedStyle(() => {
        return {
            // Visibilidade das sub-opções (começa a aparecer após 60% da expansão)
            opacity: interpolate(inlineProgress.value, [0.6, 1], [0, 1]),
            // Movimento de entrada das opções (sobe 15px enquanto aparece)
            transform: [{ translateY: interpolate(inlineProgress.value, [0.6, 1], [15, 0]) }],
        };
    });

    // Map pin visual language: category icon + color
    const getCategoryPinMeta = useCallback((category?: string) => {
        const c = String(category || '').toLowerCase();

        let image = CATEGORY_IMAGES.default;

        if (c === 'auto' || c.includes('mec') || c.includes('officina') || c.includes('car')) image = CATEGORY_IMAGES.auto;
        else if (c === 'electronics' || c.includes('eletrôn') || c.includes('cell')) image = CATEGORY_IMAGES.electronics;
        else if (c === 'hvac' || c.includes('ar') || c.includes('clim') || c.includes('refrig')) image = CATEGORY_IMAGES.hvac;
        else if (c === 'plumbing' || c.includes('hidra') || c.includes('encan')) image = CATEGORY_IMAGES.plumbing;
        else if (c === 'gardening' || c.includes('agro') || c.includes('jardin')) image = CATEGORY_IMAGES.gardening;
        else if (c === 'cleaning' || c.includes('limp')) image = CATEGORY_IMAGES.cleaning;
        else if (c === 'beauty' || c.includes('beleza') || c.includes('manic')) image = CATEGORY_IMAGES.beauty;
        else if (c === 'carpentry' || c.includes('marc') || c.includes('madeira')) image = CATEGORY_IMAGES.carpentry;
        else if (c === 'pest_control' || c.includes('dedet')) image = CATEGORY_IMAGES.pest_control;
        else if (c === 'handyman' || c.includes('marido') || c.includes('geral')) image = CATEGORY_IMAGES.handyman;
        else if (c === 'electrical' || c.includes('eletri')) image = CATEGORY_IMAGES.electrical;

        return { image };
    }, []);

    // Fade in sticky header only when sheet is essentially touching the top
    const headerFadeInStart = sheetPeek - 100;
    const headerFadeInEnd = sheetPeek - 20;

    const stickyHeaderOpacity = scrollY.interpolate({
        inputRange: [headerFadeInStart, headerFadeInEnd],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    const stickyHeaderTranslateY = scrollY.interpolate({
        inputRange: [headerFadeInStart, headerFadeInEnd],
        outputRange: [-8, 0],
        extrapolate: 'clamp',
    });

    const greetingOpacity = scrollY.interpolate({
        inputRange: [headerFadeInStart, sheetPeek - 40],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });

    const logoOpacity = scrollY.interpolate({
        inputRange: [sheetPeek - 300, sheetPeek - 120],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    const handleOpenRequest = (trackId: string) => {
        setShowInlineOptions(false);
        startDraft('', trackId as 'instant' | 'evaluation' | 'workshop');
        router.push({ pathname: '/request/new', params: { mode: trackId } });
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={[styles.container, { backgroundColor: '#f2f2f2' }]} edges={['left', 'right']}>

                <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

                <AddressSelectionModal
                    visible={addressModalVisible}
                    onClose={() => setAddressModalVisible(false)}
                />

                {/* Fixed Logo (Fades out when sheet moves up) */}
                <RNAnimated.View
                    style={{
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'absolute',
                        top: insets.top + (Platform.OS === 'ios' ? 0 : 6),
                        alignSelf: 'center',
                        zIndex: 100,
                        opacity: logoOpacity,
                    }}
                >
                    <ExpoImage
                        source={require('../../../assets/images/logo.svg')}
                        style={{
                            width: 110,
                            height: 40,
                            marginLeft: 16,
                        }}
                        contentFit="contain"
                    />

                    {/* Clickable Address Pill */}
                    <TouchableOpacity
                        style={styles.addressRow}
                        onPress={() => setAddressModalVisible(true)}
                        activeOpacity={0.8}
                    >
                        <MapPin size={14} color={Colors.light.accent} />
                        <Text style={styles.addressText} numberOfLines={1}>
                            {isLoadingLocation ? 'Localizando...' : currentAddress}
                        </Text>
                        <ChevronRight size={14} color={Colors.light.textSecondary} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                </RNAnimated.View>

                {/* GPS Shortcut FAB */}


                {/* ... rest of render ... */}

                {/* Active Request Bar (Mini Player Style) */}
                {(requestStatus === 'NEW' || requestStatus === 'OFFERED' || requestStatus === 'ACCEPTED' || requestStatus === 'PAID' || requestStatus === 'EN_ROUTE') && (
                    <TouchableOpacity
                        style={styles.activeRequestBar}
                        onPress={() => router.push('/request/new/match')}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={styles.pulseDot} />
                            <Text style={styles.activeRequestText}>
                                {requestStatus === 'NEW' ? 'Buscando profissional...' :
                                    requestStatus === 'OFFERED' ? 'Aguardando resposta...' :
                                        requestStatus === 'ACCEPTED' ? 'Aguardando pagamento...' :
                                            requestStatus === 'PAID' ? 'Profissional a caminho' :
                                                'Em andamento'}
                                <Text style={{ fontWeight: 'normal', fontSize: 12 }}> • {requestCategory || 'Solicitação'}</Text>
                            </Text>
                        </View>
                        <ChevronRight size={20} color="#fff" />
                    </TouchableOpacity>
                )}

                <View style={styles.root}>
                    {/* Fixed full-screen map background */}
                    <MapView
                        ref={mapRef}
                        style={StyleSheet.absoluteFillObject}
                        initialRegion={{
                            latitude: -8.77500, // shifted south to visually center user in top half
                            longitude: -63.90177,
                            latitudeDelta: 0.05,
                            longitudeDelta: 0.05,
                        }}
                        provider={PROVIDER_GOOGLE}
                        scrollEnabled
                        zoomEnabled
                        rotateEnabled={true}
                        pitchEnabled={true}
                        mapType="standard"

                        userInterfaceStyle="light"
                        showsUserLocation={false}
                        showsMyLocationButton={false}
                        toolbarEnabled={false}
                        onPanDrag={() => {
                            if (!showRecenterBtn) setShowRecenterBtn(true);
                        }}
                        customMapStyle={[
                            {
                                "featureType": "poi",
                                "stylers": [{ "visibility": "off" }]
                            },
                            {
                                "featureType": "transit",
                                "stylers": [{ "visibility": "off" }]
                            },
                            {
                                "elementType": "labels.icon",
                                "stylers": [{ "visibility": "off" }]
                            }
                        ]}
                    >
                        {/* Custom User Location Marker */}
                        {location && (
                            <Marker
                                coordinate={{
                                    latitude: location.coords.latitude,
                                    longitude: location.coords.longitude,
                                }}
                                anchor={{ x: 0.5, y: 0.5 }} // Center the pulsing circle
                                zIndex={999} // Ensure it's on top of other markers
                            >
                                <AnimatedUserMarker />
                            </Marker>
                        )}
                        {/* Service Location Marker - appears when address is confirmed */}
                        {selectedLocation && (
                            <Marker
                                key={`${selectedLocation.latitude}-${selectedLocation.longitude}`}
                                coordinate={{
                                    latitude: selectedLocation.latitude,
                                    longitude: selectedLocation.longitude,
                                }}
                                anchor={{ x: 0.5, y: 0.5 }}
                                zIndex={1000}
                                title="Endereço Selecionado"
                                description={selectedLocation.address}
                            >
                                <View style={styles.serviceLocationMarker}>
                                    <Image
                                        source={require('../../../assets/images/wavinghuman.png')}
                                        style={{ width: 64, height: 64 }}
                                        resizeMode="contain"
                                    />
                                </View>
                            </Marker>
                        )}
                        {/* Partner markers (category icon + category color + rating preview) */}
                        {filteredProviders.map((provider) => {
                            const isOnline = String(provider?.status || '').toLowerCase() === 'online';
                            const { image } = getCategoryPinMeta(provider?.category);
                            const ratingValue = provider?.rating;
                            const ratingText = typeof ratingValue === 'number' ? ratingValue.toFixed(1) : (ratingValue ? String(ratingValue) : '—');

                            // Offline status logic (Red dot)
                            const statusColor = isOnline ? Colors.light.success : '#EF4444';

                            return (
                                <Marker
                                    key={provider.id}
                                    coordinate={provider.coordinates}
                                    anchor={{ x: 0.5, y: 0.5 }}
                                    onPress={() => router.push(`/provider/${provider.id}`)}
                                >
                                    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                        {/* Floating 3D Icon - No Background Circle */}
                                        <Image
                                            source={image}
                                            style={{ width: 50, height: 50, opacity: isOnline ? 1 : 0.6 }} // Fade offline users slightly
                                            resizeMode="contain"
                                        />

                                        {/* Status Dot (Green or Red) */}
                                        <View style={[styles.aestheticOnlineDot, { backgroundColor: statusColor }]} />

                                        <View style={styles.aestheticRatingPill}>
                                            <Star size={8} color="#F59E0B" fill="#F59E0B" />
                                            <Text style={styles.aestheticRatingText}>{ratingText}</Text>
                                        </View>
                                    </View>
                                </Marker>
                            );
                        })}
                    </MapView>

                    {/* Top Gradient Blur + Tint Overlay */}
                    {Platform.OS === 'ios' && (
                        <View style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: 180,
                            zIndex: 10,
                            pointerEvents: 'none'
                        }}>
                            <LinearGradient
                                colors={['rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 1)', 'rgba(255,255,255,0)']}
                                style={StyleSheet.absoluteFill}
                            />
                        </View>
                    )}

                    {/* GPS Shortcut FAB - Positioned just above the sheet */}

                    {showRecenterBtn && (
                        <Reanimated.View
                            entering={FadeIn.duration(100)}
                            exiting={FadeOut.duration(100)}
                            style={{
                                position: 'absolute',
                                right: 20,
                                bottom: (height * 0.45) + 30, // Align with sheet top (approx)
                                zIndex: 10,
                                marginBottom: -100,
                            }}
                        >
                            <TouchableOpacity
                                style={{
                                    backgroundColor: '#fff',
                                    borderRadius: 30,
                                    width: 50,
                                    height: 50,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    shadowColor: "#000",
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 5,
                                    elevation: 5,
                                }}
                                onPress={handleGpsShortcut}
                            >
                                <Locate size={22} color={Colors.light.primary} strokeWidth={2.5} />
                            </TouchableOpacity>
                        </Reanimated.View>
                    )}

                    {/* White Background Overlay (Fades in on Expand) */}
                    <Reanimated.View
                        style={[
                            StyleSheet.absoluteFillObject,
                            { backgroundColor: '#FFFFFF', zIndex: 15 },
                            rBackgroundStyle
                        ]}
                    />

                    {/* Floating Map Button - appears when sheet fully expanded */}
                    <Reanimated.View
                        style={[
                            {
                                position: 'absolute',
                                bottom: 30 + insets.bottom,
                                right: 20,
                                zIndex: 25,
                                marginBottom: -30
                            },
                            rFloatingMapBtnStyle
                        ]}
                    >
                        <TouchableOpacity
                            style={{
                                backgroundColor: '#FFFFFF',
                                borderRadius: 30,
                                width: 56,
                                height: 56,
                                alignItems: 'center',
                                justifyContent: 'center',
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.15,
                                shadowRadius: 8,
                                elevation: 6,
                                borderWidth: 1,
                                borderColor: 'rgba(0,0,0,0.06)',
                            }}
                            onPress={handleCollapseSheet}
                            activeOpacity={0.7}
                        >
                            <Map size={24} color={Colors.light.primary} />
                        </TouchableOpacity>
                    </Reanimated.View>



                    {/* Bottom Sheet Container - Gesture Handler */}
                    <GestureDetector gesture={combinedGesture}>
                        <Reanimated.View
                            style={[
                                {
                                    position: 'absolute',
                                    width: '100%',
                                    height: SCREEN_HEIGHT,
                                    top: SCREEN_HEIGHT, // Start below screen, animate up with translateY (negative)
                                    backgroundColor: 'transparent',
                                    zIndex: 20,
                                },
                                rBottomSheetStyle
                            ]}
                        >

                            <Reanimated.View style={[
                                styles.sheet,
                                { flex: 1, paddingBottom: 0 },
                                rSheetFinishStyle
                            ]}>
                                {/* Drag Handle */}
                                <Reanimated.View style={[{ width: '100%', alignItems: 'center', paddingBottom: 12, marginTop: -6 }, rElementFadeStyle]}>
                                    <View style={{ width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 2.5 }} />
                                </Reanimated.View>

                                {/* Static Header CTA - Stays at top */}
                                <View style={{ width: '100%', marginBottom: 20 }}>
                                    <Reanimated.View style={[
                                        { overflow: 'hidden', width: '100%' },
                                        rInlineContainerStyle
                                    ]}>
                                        {!showInlineOptions ? (
                                            <TouchableOpacity
                                                style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                                                onPress={() => setShowInlineOptions(true)}
                                                activeOpacity={0.85}
                                            >
                                                <Reanimated.Text style={[
                                                    { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold', letterSpacing: 0.3 },
                                                    rCtaTextStyle
                                                ]}>Preciso de Reparo!</Reanimated.Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <Reanimated.View style={[{ flex: 1 }, rOptionsStyle]}>
                                                {/* Cabeçalho das Opções: Ajuste margens e cores aqui */}
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' }}>Como podemos ajudar?</Text>
                                                    <TouchableOpacity
                                                        onPress={() => setShowInlineOptions(false)}
                                                        style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 6, borderRadius: 20 }}
                                                    >
                                                        <X size={18} color="#FFFFFF" />
                                                    </TouchableOpacity>
                                                </View>

                                                {[
                                                    { id: 'instant', title: 'Hoje (Urgente)', sub: 'Preciso de ajuda agora', icon: Zap, color: '#EF4444', bg: '#FFFFFF' },
                                                    { id: 'evaluation', title: 'Avaliar', sub: 'Quero um orçamento', icon: ClipboardList, color: '#3B82F6', bg: '#FFFFFF' },
                                                    { id: 'workshop', title: 'Oficina', sub: 'Levar para oficina', icon: Wrench, color: '#8B5CF6', bg: '#FFFFFF' }
                                                ].map((opt) => {
                                                    const Icon = opt.icon;
                                                    return (
                                                        <TouchableOpacity
                                                            key={opt.id}
                                                            style={{
                                                                flexDirection: 'row',
                                                                alignItems: 'center',
                                                                // Ajuste a opacidade do fundo (0.15) e borda (0.1) das opções
                                                                backgroundColor: 'rgba(255,255,255,0.15)',
                                                                borderRadius: 16,
                                                                padding: 14,
                                                                marginBottom: 10, // Margem entre as opções
                                                                borderWidth: 1,
                                                                borderColor: 'rgba(255,255,255,0.1)'
                                                            }}
                                                            onPress={() => handleOpenRequest(opt.id)}
                                                            activeOpacity={0.7}
                                                        >
                                                            {/* Ícone fixo em fundo branco para contraste */}
                                                            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                                                                <Icon size={22} color={opt.color} />
                                                            </View>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' }}>{opt.title}</Text>
                                                                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{opt.sub}</Text>
                                                            </View>
                                                            <ChevronRight size={18} color="rgba(255,255,255,0.5)" />
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </Reanimated.View>
                                        )}
                                    </Reanimated.View>
                                </View>

                                {/* Scrollable Content Area */}
                                <GestureDetector gesture={scrollGesture}>
                                    <Reanimated.ScrollView
                                        style={{ flex: 1 }}
                                        animatedProps={rScrollViewProps}
                                        onScroll={scrollHandler}
                                        scrollEventThrottle={16}
                                        showsVerticalScrollIndicator={false}
                                        bounces={false}
                                        overScrollMode="never"
                                        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
                                    >
                                        {/* Last Services Section */}
                                        <View style={{ marginBottom: 24 }}>
                                            <View style={[styles.listHeader, { marginBottom: 12 }]}>
                                                <Text style={styles.sectionTitle}>Últimos Serviços</Text>
                                                <TouchableOpacity
                                                    activeOpacity={0.7}
                                                    onPress={() => router.push('/(tabs)/requests')}
                                                >
                                                    <Text style={styles.seeAll}>Ver histórico</Text>
                                                </TouchableOpacity>
                                            </View>
                                            <FlatList
                                                horizontal
                                                showsHorizontalScrollIndicator={false}
                                                data={[
                                                    {
                                                        id: 'h1',
                                                        orderIdShort: '2841',
                                                        title: 'Ar-condicionado não gela',
                                                        category: 'Refrigeração • Residencial',
                                                        providerName: 'Clima Bom',
                                                        providerRating: 4.9,
                                                        providerVerified: true,
                                                        dateTime: 'Ontem • 14:30',
                                                        locationLabel: 'Porto Velho (Centro)',
                                                        priceLabel: 'R$ 250',
                                                        status: 'FINISHED' as const,
                                                        hasWarranty: true,
                                                        warrantyStartDate: '2025-12-05T10:00:00Z',
                                                        warrantyEndDate: '2026-03-05T10:00:00Z', // Clearly ACTIVE
                                                        icon: require('../../../assets/images/snowflake.png')
                                                    },
                                                    {
                                                        id: 'h2',
                                                        orderIdShort: '2750',
                                                        title: 'Troca de Pneu',
                                                        category: 'Mecânica • Oficina',
                                                        providerName: 'Borracharia JP',
                                                        providerRating: 4.7,
                                                        providerVerified: false,
                                                        dateTime: '21 Out • 09:15',
                                                        locationLabel: 'Porto Velho (Liberdade)',
                                                        priceLabel: 'R$ 80',
                                                        status: 'FINISHED' as const,
                                                        hasWarranty: false,
                                                        icon: require('../../../assets/images/shopping_cart.png')
                                                    },
                                                    {
                                                        id: 'h3',
                                                        orderIdShort: '2612',
                                                        title: 'Pintura de Fachada',
                                                        category: 'Construção • Pintura',
                                                        providerName: 'Mestre da Cor',
                                                        providerRating: 4.5,
                                                        providerVerified: true,
                                                        dateTime: '15 Out • 08:00',
                                                        locationLabel: 'Porto Velho (São Cristóvão)',
                                                        priceLabel: 'R$ 1.200',
                                                        status: 'FINISHED' as const,
                                                        hasWarranty: true,
                                                        warrantyStartDate: '2025-10-01T08:00:00Z',
                                                        warrantyEndDate: '2025-12-15T08:00:00Z', // Clearly EXPIRED
                                                        icon: require('../../../assets/images/wrench_tool.png')
                                                    },
                                                ]}
                                                keyExtractor={item => item.id}
                                                contentContainerStyle={{ paddingRight: 20 }}
                                                renderItem={({ item }) => (
                                                    <ServiceCard
                                                        orderIdShort={item.orderIdShort}
                                                        status={item.status}
                                                        title={item.title}
                                                        category={item.category}
                                                        providerName={item.providerName}
                                                        providerRating={item.providerRating}
                                                        providerVerified={item.providerVerified}
                                                        dateTime={item.dateTime}
                                                        locationLabel={item.locationLabel}
                                                        priceLabel={item.priceLabel}
                                                        hasWarranty={item.hasWarranty}
                                                        warrantyStartDate={item.warrantyStartDate}
                                                        warrantyEndDate={item.warrantyEndDate}
                                                        style={{ width: 300, marginRight: 16 }}
                                                        onPress={() => router.push('/(tabs)/requests')}
                                                        onChatPress={() => router.push('/chat')}
                                                    />
                                                )}
                                            />
                                        </View>

                                        {/* Providers List */}
                                        <View style={styles.listHeader}>
                                            <Text style={styles.sectionTitle}>Disponíveis Agora</Text>
                                            <TouchableOpacity
                                                activeOpacity={0.7}
                                                onPress={() => router.push('/(tabs)/search')}
                                            >
                                                <Text style={styles.seeAll}>Ver todos</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {filteredProviders.map((provider: any) => (
                                            <ProviderCard
                                                key={provider.id}
                                                provider={provider}
                                                onPress={() => router.push(`/provider/${provider.id}`)}
                                            />
                                        ))}

                                        {loading && (
                                            <>
                                                <SkeletonProviderCard />
                                                <SkeletonProviderCard />
                                                <SkeletonProviderCard />
                                            </>
                                        )}

                                    </Reanimated.ScrollView>
                                </GestureDetector>
                            </Reanimated.View>
                        </Reanimated.View>
                    </GestureDetector>

                    {/* Sticky Header (fades in only when the sheet is touching the top) */}
                    {/* Note: In this fixed layout, sticky header logic might need adjustment or removal since sheet doesn't scroll to top.
                    For now, I'll keep it visible if needed, or hide it.
                    Given the new layout, the static Header with Address is always visible at the top.
                    The 'sticky' version was for when the list covers the map.
                    I'll comment it out to avoid confusion and clutter.
                */}
                    {/*
                <Animated.View
                    style={[
                        styles.stickyHeader,
                        {
                            paddingTop: insets.top + 6,
                            opacity: stickyHeaderOpacity,
                            transform: [{ translateY: stickyHeaderTranslateY }],
                        },
                    ]}
                    pointerEvents="none"
                >
                    <View style={styles.stickyHeaderBar}>
                        <View style={styles.stickyHeaderLeft}>
                            <Text style={styles.stickyNameText}>Bem-vindo, {clientName}</Text>
                            <View style={styles.stickyAddressRow}>
                                <MapPin size={14} color={Colors.light.primary} />
                                <Text style={styles.stickyAddressText} numberOfLines={1}>
                                    {currentAddress}
                                </Text>
                            </View>
                        </View>

                    </View>
                </Animated.View>
                */}
                </View >
            </SafeAreaView >
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    root: {
        flex: 1,
    },
    sheetScroll: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    sheetScrollContent: {
        paddingHorizontal: 0,
    },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 20,
        paddingTop: 18, // Tighter so the drag handle sits closer to the top
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 6,
    },
    partnerMarker: {
        width: 86,
        height: 86,
        alignItems: 'center',
        justifyContent: 'center',
    },
    partnerMarkerCore: {
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
    },
    partnerMarkerHalo: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: Colors.light.success, // pulsing green
    },
    partnerMarkerHaloWrap: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    partnerMarkerBubble: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#FFFFFF', // default; overridden per category on marker
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.16,
        shadowRadius: 8,
        elevation: 6,
        overflow: 'hidden',
    },
    partnerMarkerIcon: {
        width: 14,
        height: 14,
        resizeMode: 'contain',
    },
    partnerMarkerAvatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        resizeMode: 'cover',
    },
    partnerOnlineDot: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.light.success,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    serviceLocationMarker: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    servicePinOuter: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(253, 123, 5, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    servicePinInner: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: Colors.light.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    activeRequestBar: {
        position: 'absolute',
        bottom: 90, // above tabs
        left: 20,
        right: 20,
        backgroundColor: '#222',
        padding: 15,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 100,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 10,
    },
    pulseDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.light.success,
        marginRight: 10,
    },
    activeRequestText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    mapHeroOverlay: {
        position: 'absolute',
        left: 14,
        right: 14,
    },

    loadingText: {
        fontSize: 12,
        color: Colors.light.textSecondary,
    },
    partnerCtaCard: {
        backgroundColor: '#1E293B',
        marginHorizontal: 4,
        marginTop: 20,
        marginBottom: 30,
        borderRadius: 20,
        padding: 24,
        overflow: 'hidden',
        position: 'relative',
    },
    partnerCtaContent: {
        zIndex: 2,
    },
    partnerCtaTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    partnerCtaText: {
        fontSize: 14,
        color: '#94A3B8',
        marginBottom: 20,
        lineHeight: 20,
        maxWidth: '80%',
    },
    partnerCtaButton: {
        backgroundColor: Colors.light.primary,
        alignSelf: 'flex-start',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
    },
    partnerCtaButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    partnerCtaImage: {
        position: 'absolute',
        bottom: -20,
        right: -20,
        width: 140,
        height: 140,
        transform: [{ rotate: '-15deg' }],
        zIndex: 1,
    },

    appNameSmall: {
        fontSize: 13,
        fontWeight: '800',
        color: Colors.light.text,
        letterSpacing: -0.2,
        marginBottom: 4,
    },
    clientName: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors.light.text,
        letterSpacing: -0.3,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        marginLeft: 1.5,
    },
    addressText: {
        marginLeft: 6,
        fontSize: 13,
        color: Colors.light.textSecondary,
        maxWidth: 150, // Limit width to trigger ellipsis properly while allowing reasonable length
    },
    stickyNamePill: {
        backgroundColor: 'rgba(253, 123, 5, 0.12)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(253, 123, 5, 0.18)',
    },
    stickyNameText: {
        fontSize: 12,
        fontWeight: '800',
        color: Colors.light.primary,
    },

    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.light.text,
    },
    mapBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    activeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.light.success,
        marginRight: 6,
    },
    mapBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: Platform.OS === 'ios' ? Colors.light.text : '#333',
    },
    stickyHeader: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        zIndex: 200,
    },
    stickyHeaderBar: {
        marginHorizontal: 14,
        backgroundColor: '#fff',
        borderRadius: 30,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 10,
    },
    stickyHeaderLeft: {
        flex: 1,
        paddingRight: 10,
    },
    stickyAppName: {
        fontSize: 15,
        fontWeight: '800',
        color: Colors.light.text,
        letterSpacing: -0.2,
    },
    stickyAddressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    stickyAddressText: {
        marginLeft: 6,
        fontSize: 12,
        color: Colors.light.textSecondary,
        flex: 1,
    },
    stickyAvatarBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
    },
    stickyAvatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
    },
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    seeAll: {
        color: Colors.light.primary,
        fontWeight: '400',
        paddingHorizontal: 6,
    },
    providerCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        padding: 14,
        borderRadius: 16,
        marginBottom: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    providerImage: {
        width: 64,
        height: 64,
        borderRadius: 12,
        backgroundColor: '#eee',
    },
    providerInfo: {
        flex: 1,
        marginLeft: 14,
        justifyContent: 'center',
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    providerNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    providerName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: Colors.light.textSecondary,
        marginRight: 6,
    },
    verifiedIndicator: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    verifiedText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    ratingText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#B45309',
        marginLeft: 4,
    },
    providerCategory: {
        fontSize: 12,
        color: Colors.light.textSecondary,
        marginBottom: 4,
    },
    providerPriceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    providerPrice: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.light.primary,
    },
    onlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.light.successBackground,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    onlineDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.light.success,
        marginRight: 4,
    },
    onlineText: {
        fontSize: 10,
        fontWeight: '600',
        color: Colors.light.success,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        width: '100%',
    },
    modalOptionIcon: {
        width: 40,
        height: 40,
        resizeMode: 'contain',
        marginRight: 16,
    },
    modalOptionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    modalOptionSubtitle: {
        fontSize: 12,
        color: Colors.light.textSecondary,
    },
    userMarkerHaloWrap: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    userMarkerHalo: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.light.accent,
    },
    partnerMarkerRatingWrap: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: -14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    partnerMarkerRatingText: {
        marginLeft: 4,
        fontSize: 10,
        fontWeight: '700',
        color: Colors.light.text,
    },

    aestheticOnlineDot: {
        position: 'absolute',
        top: 2,
        right: 4,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.light.success,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        zIndex: 2,
    },
    aestheticRatingPill: {
        position: 'absolute',
        bottom: -6,
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    aestheticRatingText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#334155',
        marginLeft: 2,
    },
});