/**
 * File: src/app/provider/[id].tsx
 * Purpose: Detailed profile view for a specific Service Provider.
 * Key Features:
 * - "iFood-style" layout with Banner, Floating Avatar, and Sticky Scroll.
 * - Displays provider metrics: Rating, Technical Visit Price, Warranty, Speed.
 * - Lists "Destaques" (Highlight services) in a horizontal scroll.
 * - Gatekeeper for contact info: Only shows WhatsApp after order acceptance.
 */
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { useRequest } from '@/context/RequestContext';
import { supabase } from '@/services/supabase';
import { PartnerHighlight, Provider } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, Heart, Search, ShieldCheck, Star, Ticket, X, Zap } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, ImageBackground, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const formatBRL = (value: number) =>
    `R$ ${value.toFixed(2).replace('.', ',')}`;

export default function ProviderDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [provider, setProvider] = useState<Provider | null>(null);
    const [loading, setLoading] = useState(true);
    const { canSeeContact, currentTicket } = useRequest();
    const insets = useSafeAreaInsets();

    // Fetch highlights for this provider
    const { data: highlights = [] } = useQuery<PartnerHighlight[]>({
        queryKey: ['partner_highlights', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('partner_highlights')
                .select('*')
                .eq('partner_id', id)
                .eq('is_active', true)
                .order('sort_order', { ascending: true });
            if (error) throw error;
            return data ?? [];
        },
        enabled: !!id,
    });

    useEffect(() => {
        const fetchProvider = async () => {
            if (!id) return;
            const { data, error } = await supabase
                .from('partners')
                .select('*')
                .eq('id', id)
                .single();

            if (data) {
                const badges: string[] = data.badges?.length ? data.badges : [];
                setProvider({
                    id: data.id,
                    name: data.full_name || 'Prestador',
                    image: data.avatar_url,
                    rating: data.rating || 5.0,
                    reviews: 0,
                    category: data.service_category,
                    categories: [data.service_category],
                    visitPrice: data.base_fee,
                    distance: '0.9 km',
                    coordinates: { latitude: 0, longitude: 0 },
                    status: data.is_online ? 'online' : 'offline',
                    badges: badges as any,
                    address: data.address_display || 'Endereço do Prestador',
                    description: data.description || undefined,
                    operationalScore: 100,
                    whatsapp: '5569999999999',
                    _bannerUrl: data.banner_url,
                } as any);
            }
            setLoading(false);
        };
        fetchProvider();
    }, [id]);

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
        );
    }

    if (!provider) return <View style={styles.container}><Text>Provider not found</Text></View>;

    const showContact = canSeeContact() && currentTicket?.providerId === provider.id;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Banner Header */}
                <ImageBackground
                    source={{ uri: (provider as any)._bannerUrl || 'https://images.unsplash.com/photo-1556910103-1c02745a30bf?q=80&w=2070&auto=format&fit=crop' }}
                    style={styles.banner}
                >
                    {/* Dark Overlay for icon visibility */}
                    <View style={styles.bannerOverlay} />

                    {/* Navigation Icons */}
                    <View style={[styles.navBar, { marginTop: insets.top - 40 }]}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
                            <X size={24} color="#fff" />
                        </TouchableOpacity>
                        <View style={styles.rightIcons}>
                            <TouchableOpacity style={styles.iconButton}>
                                <Heart size={24} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.iconButton, { marginLeft: 12 }]}>
                                <Search size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </ImageBackground>

                {/* Floating Info Card */}
                <View style={styles.cardContainer}>
                    {/* Floating Avatar */}
                    <View style={styles.avatarContainer}>
                        <Image source={{ uri: provider.image }} style={styles.avatar} />
                    </View>

                    <Text style={styles.providerName}>{provider.name}</Text>

                    <View style={styles.metaRow}>
                        <Text style={styles.metaText}>{provider.distance} • Min R$ {provider.visitPrice}</Text>
                        <ChevronRight size={14} color="#666" style={{ marginLeft: 4 }} />
                    </View>

                    {/* Rating & Badges */}
                    <TouchableOpacity style={styles.ratingRow}>
                        <View style={styles.ratingPill}>
                            <Star size={12} color={Colors.light.text} fill={Colors.light.text} />
                            <Text style={styles.ratingValue}>{provider.rating.toFixed(1)}</Text>
                        </View>
                        <Text style={styles.reviewCount}>({provider.reviews} avaliações)</Text>
                        <View style={styles.dotSeparator} />
                        {provider.badges?.map(b => (
                            <View key={b} style={styles.superBadge}>
                                <Star size={10} color="#fff" fill="#fff" />
                                <Text style={styles.superBadgeText}>{b}</Text>
                            </View>
                        ))}
                        <ChevronRight size={16} color="#ccc" style={{ marginLeft: 'auto' }} />
                    </TouchableOpacity>

                    {/* Service/Reparai Info */}
                    <View style={styles.deliveryRow}>
                        <View style={styles.infoBlock}>
                            <Text style={styles.deliveryLabel}>Visita</Text>
                            <Text style={styles.deliveryValue}>R$ {provider.visitPrice}</Text>
                        </View>
                        <View style={styles.verticalSeparator} />
                        <View style={styles.infoBlock}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <ShieldCheck size={12} color={Colors.light.success} style={{ marginRight: 4 }} />
                                <Text style={styles.deliveryLabel}>Garantia</Text>
                            </View>
                            <Text style={[styles.deliveryValue, { color: Colors.light.success }]}>3 Meses</Text>
                        </View>
                        <View style={styles.verticalSeparator} />
                        <View style={styles.infoBlock}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Zap size={12} color="#F59E0B" style={{ marginRight: 4 }} />
                                <Text style={styles.deliveryLabel}>Rápido</Text>
                            </View>
                            <Text style={styles.deliveryValue}>~30 min</Text>
                        </View>
                    </View>
                </View>

                {/* Highlights Section */}
                {highlights.length > 0 && (
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>Destaques</Text>
                        <FlatList
                            data={highlights}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.highlightCard}
                                    onPress={() => {
                                        Alert.alert('Serviço de Destaque', 'Para solicitar este serviço com orçamento no local, faça um pedido na tela inicial.');
                                        /* Temporarily disabled during MVP quote lifecycle pilot:
                                        router.push({
                                            pathname: '/provider/highlight-checkout',
                                            params: {
                                                highlightId: item.id,
                                                providerId: provider!.id,
                                                providerName: provider!.name,
                                                serviceName: item.name,
                                                servicePrice: String(item.price),
                                                displacementFee: String(provider!.visitPrice || 0),
                                                imageUrl: item.image_url || '',
                                            },
                                        });
                                        */
                                    }}
                                >
                                    {item.image_url ? (
                                        <Image source={{ uri: item.image_url }} style={styles.highlightImage} />
                                    ) : (
                                        <View style={[styles.highlightImage, { backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }]}>
                                            <Star size={20} color="#CBD5E1" />
                                        </View>
                                    )}
                                    <View style={styles.highlightContent}>
                                        <View style={styles.priceRow}>
                                            <Text style={styles.price}>{formatBRL(item.price)}</Text>
                                            {item.original_price != null && (
                                                <Text style={styles.originalPrice}>{formatBRL(item.original_price)}</Text>
                                            )}
                                        </View>
                                        <Text style={styles.highlightTitle} numberOfLines={2}>{item.name}</Text>
                                        <Text style={styles.brandTitle} numberOfLines={1}>{provider.name}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                )}

                {/* About / Description */}
                <View style={[styles.sectionContainer, { paddingHorizontal: 20 }]}>
                    <Text style={styles.sectionTitle}>Sobre</Text>
                    <Text style={styles.description}>
                        {provider.description || `Profissional qualificado com experiência na área de ${provider.category}. Atende em toda a região de Porto Velho com rapidez e garantia de serviço.`}
                    </Text>
                </View>

                {/* Action Buttons (Original Functionality Kept) */}
                <View style={{ padding: 20 }}>
                    <Button
                        title="Abrir Solicitação"
                        onPress={() => router.push({
                            pathname: '/request/new/details',
                            params: { category: provider.category, mode: 'instant' }
                        })}
                        style={styles.mainBtn}
                    />
                    {!showContact && (
                        <Text style={styles.gatekeepingText}>
                            Contato após aceitar pedido
                        </Text>
                    )}
                </View>

            </ScrollView>

            {/* Bottom Coupon Bar */}
            <View style={[styles.couponBar, { paddingBottom: insets.bottom + 12 }]}>
                <Ticket size={20} color="#A855F7" fill="#A855F7" />
                <Text style={styles.couponText}>
                    <Text style={{ fontWeight: 'bold' }}>R$ 50</Text> em coupons aqui
                </Text>
                <ChevronRight size={16} color="#A855F7" style={{ marginLeft: 'auto' }} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA', // Light gray background for body
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    banner: {
        width: '100%',
        height: 180, // Reduced height for the "banner" look
        justifyContent: 'flex-start',
    },
    bannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    navBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center', // Fix vertical alignment of icons
        paddingHorizontal: 16,
    },
    rightIcons: {
        flexDirection: 'row',
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // The Floating Card
    cardContainer: {
        marginHorizontal: 16,
        marginTop: -40, // Overlap the banner
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingTop: 45, // Space for the half-out avatar
        paddingBottom: 20,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        alignItems: 'center',
    },
    avatarContainer: {
        marginTop: -90, // Pull up to overlap banner
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#fff',
        padding: 4, // White border effect
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 5,
        marginBottom: 8,
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 40,
    },
    providerName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E293B',
        textAlign: 'center',
        marginBottom: 4,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    metaText: {
        fontSize: 13,
        color: '#64748B',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
        marginBottom: 12,
    },
    ratingPill: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 6,
    },
    ratingValue: {
        fontWeight: 'bold',
        fontSize: 14,
        marginLeft: 4,
        color: '#1E293B',
    },
    reviewCount: {
        color: '#94A3B8',
        fontSize: 13,
    },
    dotSeparator: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#CBD5E1',
        marginHorizontal: 8,
    },
    superBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EF4444', // Red for Super
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
    },
    superBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 2,
    },
    deliveryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center', // Center the blocks
        marginTop: 8,
    },
    infoBlock: {
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    verticalSeparator: {
        width: 1,
        height: 24,
        backgroundColor: '#E2E8F0',
    },
    deliveryLabel: {
        fontSize: 11,
        color: '#64748B',
        marginBottom: 2,
    },
    deliveryValue: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    deliveryTime: {
        fontSize: 13,
        color: '#64748B',
    },
    deliveryFree: {
        fontSize: 13,
        color: Colors.light.success,
        fontWeight: 'bold',
    },

    // Highlights
    sectionContainer: {
        marginTop: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E293B',
        marginLeft: 20,
        marginBottom: 12,
    },
    highlightCard: {
        width: 140,
        marginRight: 12,
        backgroundColor: '#fff',
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    highlightImage: {
        width: '100%',
        height: 100,
    },
    highlightContent: {
        padding: 10,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        flexWrap: 'wrap',
    },
    price: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1E293B',
        marginRight: 4,
    },
    originalPrice: {
        fontSize: 11,
        color: '#A855F7', // Purple logic from image
        textDecorationLine: 'line-through',
    },
    highlightTitle: {
        fontSize: 12,
        color: '#475569',
        marginTop: 4,
        lineHeight: 16,
    },
    brandTitle: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 4,
    },
    description: {
        fontSize: 14,
        color: '#64748B',
        lineHeight: 22,
    },

    // Actions
    mainBtn: {
        width: '100%',
        backgroundColor: Colors.light.primary,
    },
    gatekeepingText: {
        marginTop: 12,
        textAlign: 'center',
        fontSize: 11,
        color: '#94A3B8',
        fontStyle: 'italic',
    },

    // Coupon Bar
    couponBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 16,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 10,
    },
    couponText: {
        marginLeft: 8,
        color: '#1E293B',
        fontSize: 14,
    }
});
