import { Colors } from '@/constants/Colors';
import { Star } from 'lucide-react-native';
import React, { useState } from 'react';
import { Image, Animated as RNAnimated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Skeleton Card Component
export const SkeletonProviderCard = () => {
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
export const ProviderCard = React.memo(function ProviderCard({
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

const styles = StyleSheet.create({
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
});
