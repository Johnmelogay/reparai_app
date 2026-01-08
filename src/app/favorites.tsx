import { Colors, Layout } from '@/constants/Colors';
import { usePartners } from '@/hooks/usePartners';
import { Heart, Star } from 'lucide-react-native';
import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FavoritesScreen() {
    // For now, we reuse the same providers but pretend they are favorites
    const { providers: displayProviders } = usePartners();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Text style={styles.title}>Favoritos</Text>

            <FlatList
                data={displayProviders.slice(0, 2)} // Just pick first 2 as favorites
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.listItem}>
                        <View style={styles.listImagePlaceholder}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: Colors.light.primary }}>
                                {item.name.substring(0, 2).toUpperCase()}
                            </Text>
                        </View>
                        <View style={styles.listInfo}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.listName}>{item.name}</Text>
                                <Star size={12} color="#F59E0B" fill="#F59E0B" style={{ marginLeft: 6 }} />
                                <Text style={styles.listRating}>{item.rating}</Text>
                            </View>
                            <Text style={styles.listDesc}>{item.category} • {item.distance}</Text>
                        </View>
                        <Heart size={24} color="#EF4444" fill="#EF4444" />
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>Você ainda não tem favoritos.</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginHorizontal: Layout.spacing.lg,
        marginTop: Layout.spacing.lg,
        marginBottom: Layout.spacing.md,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: Layout.radius.lg,
        marginBottom: Layout.spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        ...Layout.shadows.small,
    },
    listImagePlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 15,
    },
    listInfo: {
        flex: 1,
    },
    listName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    listRating: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
        marginLeft: 4,
    },
    listDesc: {
        fontSize: 14,
        color: '#888',
        marginTop: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 50,
    },
    emptyText: {
        color: '#999',
        fontSize: 16,
    }
});
