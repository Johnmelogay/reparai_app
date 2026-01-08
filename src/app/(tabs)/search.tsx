import { Colors, Layout } from '@/constants/Colors';
import { usePartners } from '@/hooks/usePartners';
import { useRouter } from 'expo-router';
import { MapPin, Search, Star, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { FlatList, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const POPULAR_SEARCHES = ['Eletricista', 'Encanador', 'Limpeza AC', 'Jardineiro', 'Mecânico'];

const TOP_CATEGORIES = [
    { name: 'Mecânica', icon: require('../../../assets/images/wrench_tool.png') },
    { name: 'Refrigeração', icon: require('../../../assets/images/snowflake.png') },
    { name: 'Elétrica', icon: require('../../../assets/images/electric_plug.png') },
    { name: 'Jardinagem', icon: require('../../../assets/images/plant.png') },
];

export default function SearchScreen() {
    const [query, setQuery] = useState('');
    const { providers: displayProviders } = usePartners(); // Using shared data
    const router = useRouter();

    // Filter logic
    const results = query.length > 0
        ? displayProviders.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.category.toLowerCase().includes(query.toLowerCase())
        )
        : [];

    const handleCategoryPress = (categoryName: string) => {
        setQuery(categoryName);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>Buscar</Text>
            </View>

            <View style={styles.searchBarContainer}>
                <Search size={20} color="#999" style={styles.searchIcon} />
                <TextInput
                    style={styles.input}
                    placeholder="O que você precisa?"
                    value={query}
                    onChangeText={setQuery}
                    placeholderTextColor="#999"
                    autoFocus={false}
                />
                {query.length > 0 && (
                    <TouchableOpacity onPress={() => setQuery('')}>
                        <X size={18} color="#999" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Results or Suggestions */}
            {query.length > 0 ? (
                <FlatList
                    data={results}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.resultsList}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.resultItem} onPress={() => router.push(`/provider/${item.id}`)}>
                            <View style={styles.resultImagePlaceholder}>
                                <Text style={styles.initial}>{item.name[0]}</Text>
                            </View>
                            <View style={styles.resultInfo}>
                                <Text style={styles.resultName}>{item.name}</Text>
                                <Text style={styles.resultCategory}>{item.category}</Text>
                                <View style={styles.ratingRow}>
                                    <Star size={12} color="#F59E0B" fill="#F59E0B" />
                                    <Text style={styles.ratingText}>{item.rating}</Text>
                                    <Text style={styles.dot}>•</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <MapPin size={12} color="#999" />
                                        <Text style={styles.distanceText}>{item.distance}</Text>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>Nenhum profissional encontrado.</Text>
                        </View>
                    }
                />
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Buscas Recentes</Text>
                        <View style={styles.chipContainer}>
                            {POPULAR_SEARCHES.map((item, index) => (
                                <TouchableOpacity key={index} style={styles.chip} onPress={() => setQuery(item)}>
                                    <Text style={styles.chipText}>{item}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Categorias Populares</Text>
                        <View style={styles.gridContainer}>
                            {TOP_CATEGORIES.map((cat, idx) => (
                                <TouchableOpacity key={idx} style={styles.gridItem} onPress={() => handleCategoryPress(cat.name)}>
                                    <View style={styles.iconWrapper}>
                                        <Image source={cat.icon} style={styles.icon} />
                                    </View>
                                    <Text style={styles.gridLabel}>{cat.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        paddingHorizontal: 20,
        paddingBottom: 10,
        paddingTop: 10,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.light.text,
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.light.background,
        marginHorizontal: Layout.spacing.lg,
        paddingHorizontal: 15,
        height: 52,
        borderRadius: Layout.radius.md,
        marginBottom: Layout.spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    searchIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: Colors.light.text,
        height: '100%',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
        paddingTop: 10,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginBottom: Layout.spacing.md,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    chip: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        marginRight: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#eee',
    },
    chipText: {
        color: '#555',
        fontSize: 14,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    gridItem: {
        width: '48%',
        backgroundColor: '#fff',
        borderRadius: Layout.radius.lg,
        padding: 15,
        marginBottom: Layout.spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        ...Layout.shadows.small,
    },
    iconWrapper: {
        width: 60,
        height: 60,
        marginBottom: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        width: '100%',
        height: '100%',
        resizeMode: 'contain',
    },
    gridLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    resultsList: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#fff',
        marginBottom: Layout.spacing.sm,
        borderRadius: Layout.radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        ...Layout.shadows.small,
    },
    resultImagePlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#E0F2FE',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    initial: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.light.primary,
    },
    resultInfo: {
        flex: 1,
    },
    resultName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    resultCategory: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    ratingText: {
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 4,
        color: '#333',
    },
    dot: {
        marginHorizontal: 6,
        color: '#ccc',
    },
    distanceText: {
        fontSize: 12,
        color: '#999',
        marginLeft: 4,
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
