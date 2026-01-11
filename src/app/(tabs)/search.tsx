/**
 * File: src/app/(tabs)/search.tsx
 * Purpose: Premium Global Search screen with Advanced Filtering & GIS Ranking.
 */
import { GooglePlacesInput } from '@/components/GooglePlacesInput'; // New import
import { FilterModal, FilterState } from '@/components/modals/FilterModal';
import { MapPickerModal } from '@/components/modals/MapPickerModal';
import { Colors, Layout } from '@/constants/Colors';
import { useLocation } from '@/context/LocationContext'; // New: Location context
import { useDebounce } from '@/hooks/useDebounce'; // New: Debounce hook
import { useGooglePlaces } from '@/hooks/useGooglePlaces'; // New import
import { usePartners } from '@/hooks/usePartners';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { formatDistance } from '@/utils/geo'; // New: GIS Utils
import { useRouter } from 'expo-router';
import { Clock, Filter, MapPin, SlidersHorizontal, Star, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
    FlatList,
    Image,
    Keyboard,
    LayoutAnimation,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    UIManager,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DOMAINS = [
    { name: 'Mobilidade', slug: 'mobilidade', icon: 'car' },
    { name: 'Casa', slug: 'casa', icon: 'home' },
    { name: 'Tecnologia', slug: 'tecnologia', icon: 'cpu' },
];

const DOMAIN_MAPPING: Record<string, string[]> = {
    'mobilidade': ['auto'],
    'casa': ['hvac', 'plumbing', 'gardening', 'cleaning', 'beauty', 'carpentry', 'pest_control', 'handyman', 'electrical'],
    'tecnologia': ['electronics']
};

const FILTER_TYPES = ['Disponíveis agora', 'Todos', 'Lojas'];

export default function SearchScreen() {
    const router = useRouter();
    const { providers: allProviders, loading: loadingProviders } = usePartners();
    const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();
    const { location, selectedLocation, selectLocation } = useLocation();
    const { getPlaceDetails } = useGooglePlaces();

    // UI State
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebounce(query, 300); // 300ms delay
    const [isFocused, setIsFocused] = useState(false);
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [isMapModalVisible, setIsMapModalVisible] = useState(false); // New: Map Modal State

    // Filter State
    const [activeTypeFilter, setActiveTypeFilter] = useState('Disponíveis agora');
    const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
        sortBy: 'nearest',
        maxDistance: 20, // Default 20km
        minRating: 0
    });

    // Computed Results (Memoized for performance)
    const filteredResults = useMemo(() => {
        // If not searching and no filters applied (default state), show nothing
        const isDefaultState = !debouncedQuery && activeTypeFilter === 'Todos' && advancedFilters.minRating === 0 && advancedFilters.maxDistance === 20;

        if (isDefaultState) return [];

        let results = allProviders.map(p => {
            // Use pre-calculated rawDistance from hook (which respects selectedLocation)
            // If missing, fallback to 9999
            return { ...p, calculatedDistance: p.rawDistance ?? 9999 };
        });

        // 2. Filter Logic
        results = results.filter(p => {
            // Text Match (Name OR Domain OR Legacy Category)
            const lowerQ = debouncedQuery.toLowerCase();

            // Check if query is a Domain name
            const isDomainSearch = Object.keys(DOMAIN_MAPPING).some(d => d.includes(lowerQ));
            let matchesDomain = false;
            if (isDomainSearch) {
                // Find which domain matches the query
                const targetDomain = Object.keys(DOMAIN_MAPPING).find(d => d.includes(lowerQ));
                if (targetDomain) {
                    const validCategories = DOMAIN_MAPPING[targetDomain];
                    matchesDomain = validCategories.includes(p.category || '');
                }
            }

            const matchesText = !lowerQ ||
                p.name.toLowerCase().includes(lowerQ) ||
                p.category.toLowerCase().includes(lowerQ) ||
                matchesDomain;

            // Type Filter & Status Logic
            let matchesType = true;
            let isOnline = true; // Default assumption

            switch (activeTypeFilter) {
                case 'Disponíveis agora':
                    // Must be Online
                    matchesType = true;
                    isOnline = p.status === 'online';
                    break;
                case 'Todos':
                    // Show everyone (ignore status)
                    matchesType = true;
                    isOnline = true; // Bypass offline check
                    break;
                case 'Lojas':
                    // Must be FIXED type (Workshops/Stores)
                    // If 'type' is missing, fallback to address check
                    matchesType = p.type === 'FIXED' || p.address === 'Oficina';
                    // Should Lojas show offline stores? Usually yes (Catalog).
                    isOnline = true;
                    break;
                default:
                    matchesType = true;
            }

            // Advanced Filters
            const matchesRating = !advancedFilters.minRating || (p.rating || 0) >= advancedFilters.minRating;
            const matchesDistance = p.calculatedDistance <= advancedFilters.maxDistance;

            return matchesText && matchesType && matchesRating && matchesDistance && isOnline;
        });

        // 3. Sorting Logic
        results.sort((a, b) => {
            switch (advancedFilters.sortBy) {
                case 'nearest':
                    return a.calculatedDistance - b.calculatedDistance;
                case 'rating':
                    return (b.rating || 0) - (a.rating || 0);
                case 'price_asc':
                    return (a.hourlyRate || 0) - (b.hourlyRate || 0);
                default:
                    return 0;
            }
        });

        return results;

    }, [debouncedQuery, activeTypeFilter, advancedFilters, allProviders]);

    const handleSearchSubmit = () => {
        if (query.trim()) {
            addToHistory(query.trim());
            Keyboard.dismiss();
        }
    };

    const handleHistoryTap = (term: string) => {
        setQuery(term);
    };

    const clearQuery = () => {
        setQuery('');
        setAdvancedFilters(prev => ({ ...prev, minRating: 0, maxDistance: 20 })); // Reset advanced filters on clear? Optional.
        // Actually, clearing search box shouldn't necessarily reset advanced filters, but usually resets the flow.
        Keyboard.dismiss();
    };

    const renderResultItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={styles.resultCard}
            onPress={() => {
                if (query) addToHistory(query);
                router.push(`/provider/${item.id}`);
            }}
        >
            <Image
                source={{ uri: item.image || 'https://via.placeholder.com/150' }}
                style={styles.resultImage}
            />
            <View style={styles.resultContent}>
                <View style={styles.resultHeader}>
                    <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                    {item.status === 'online' && <View style={styles.onlineDot} />}
                </View>
                <Text style={styles.resultCategory}>{item.category}</Text>

                <View style={styles.metaRow}>
                    <View style={styles.ratingBadge}>
                        <Star size={10} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.ratingText}>{item.rating?.toFixed(1) || 'N/A'}</Text>
                    </View>
                    <Text style={styles.dot}>•</Text>
                    <View style={styles.locationBadge}>
                        <MapPin size={10} color="#666" />
                        <Text style={styles.distanceText}>
                            {/* Use calculated GIS distance if available, fallback to item.distance */}
                            {location ? formatDistance(item.calculatedDistance) : item.distance}
                        </Text>
                    </View>
                    {item.hourlyRate && (
                        <>
                            <Text style={styles.dot}>•</Text>
                            <Text style={styles.priceText}>R$ {item.hourlyRate}/h</Text>
                        </>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );

    // Determines if we are in "Search Mode" (query typed OR filters active)
    const isSearchMode = query.length > 0 || activeTypeFilter !== 'Todos' || advancedFilters.minRating > 0 || advancedFilters.sortBy !== 'nearest';
    // Use filteredResults length to decide what to show

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={{ flex: 1 }}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.pageTitle}>Buscar</Text>
                    </View>

                    {/* Search Input Row with Google Places Autocomplete */}
                    <View style={[styles.searchContainer, { zIndex: 1000 }]}>
                        <GooglePlacesInput
                            value={query}
                            onChangeText={setQuery}
                            onSelect={async (placeId, text) => {
                                setQuery(text);
                                // Fetch details using the top-level hook instance
                                const details = await getPlaceDetails(placeId);

                                if (details) {
                                    // Update location context if a place is selected
                                    selectLocation(
                                        details.location.latitude,
                                        details.location.longitude,
                                        details.formattedAddress
                                    );
                                    // Optionally filter providers by this new location?
                                    // For now just setting the query and location is good.
                                }
                            }}
                            placeholder="Profissional, categoria ou local..."
                            onSubmitEditing={handleSearchSubmit}
                            returnKeyType="search"
                            containerStyle={{ flex: 1 }}
                        />

                        {/* Clear Button (Manual because GooglePlacesInput doesn't have it built-in yet) */}
                        {query.length > 0 && (
                            <TouchableOpacity onPress={clearQuery} style={{ position: 'absolute', right: 80, top: 16, zIndex: 1001 }}>
                                <View style={styles.clearBtn}>
                                    <X size={12} color="#fff" />
                                </View>
                            </TouchableOpacity>
                        )}

                        {/* Filter Button */}
                        <TouchableOpacity
                            style={[
                                styles.filterBtn,
                                (advancedFilters.sortBy !== 'nearest' || advancedFilters.minRating > 0 || advancedFilters.maxDistance !== 20) && styles.filterBtnActive
                            ]}
                            onPress={() => setFilterModalVisible(true)}
                        >
                            <SlidersHorizontal
                                size={20}
                                color={(advancedFilters.sortBy !== 'nearest' || advancedFilters.minRating > 0 || advancedFilters.maxDistance !== 20) ? '#fff' : '#333'}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Sub-Header: Address Picker (Clickable) */}
                    <TouchableOpacity
                        style={styles.addressPickerBtn}
                        onPress={() => setIsMapModalVisible(true)}
                        activeOpacity={0.8}
                    >
                        <MapPin size={14} color={Colors.light.primary} />
                        <Text style={styles.addressPickerText} numberOfLines={1}>
                            {selectedLocation?.address || 'Usar localização atual'}
                        </Text>
                        <Text style={styles.changeText}>Alterar</Text>
                    </TouchableOpacity>

                    {/* Type Filters (Pills) */}
                    <View style={styles.filterRow}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                            {FILTER_TYPES.map(type => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.filterChip, activeTypeFilter === type && styles.filterChipActive]}
                                    onPress={() => {
                                        setActiveTypeFilter(type);
                                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    }}
                                >
                                    <Text style={[styles.filterText, activeTypeFilter === type && styles.filterTextActive]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Content Body */}
                    <View style={styles.body}>
                        {/* Show Results if searching/filtering, otherwise History/Categories */}
                        {isSearchMode ? (
                            <FlatList
                                data={filteredResults}
                                keyExtractor={item => item.id}
                                renderItem={renderResultItem}
                                contentContainerStyle={styles.resultsList}
                                ListEmptyComponent={
                                    <View style={styles.emptyState}>
                                        <Filter size={48} color="#E5E7EB" />
                                        <Text style={styles.emptyTitle}>Nenhum resultado encontrado</Text>
                                        <Text style={styles.emptySub}>Ajuste os filtros ou tente outro termo.</Text>
                                    </View>
                                }
                            />
                        ) : (
                            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                                {/* Recent Searches */}
                                {history.length > 0 && (
                                    <View style={styles.section}>
                                        <View style={styles.sectionHeader}>
                                            <Text style={styles.sectionTitle}>Recentes</Text>
                                            <TouchableOpacity onPress={clearHistory}>
                                                <Text style={styles.clearText}>Limpar</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <View style={styles.historyList}>
                                            {history.map((term, idx) => (
                                                <TouchableOpacity
                                                    key={idx}
                                                    style={styles.historyItem}
                                                    onPress={() => handleHistoryTap(term)}
                                                >
                                                    <Clock size={14} color="#9CA3AF" style={{ marginRight: 8 }} />
                                                    <Text style={styles.historyText}>{term}</Text>
                                                    <TouchableOpacity
                                                        style={{ padding: 4 }}
                                                        onPress={() => removeFromHistory(term)}
                                                    >
                                                        <X size={12} color="#D1D5DB" />
                                                    </TouchableOpacity>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                )}

                                {/* Categories (now Domains) */}
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Navegar por Área</Text>
                                    <View style={styles.grid}>
                                        {DOMAINS.map((domain, idx) => (
                                            <TouchableOpacity
                                                key={idx}
                                                style={styles.gridCard}
                                                onPress={() => setQuery(domain.name)} // Search by Domain name
                                            >
                                                <View style={[styles.iconCircle, { backgroundColor: idx % 2 === 0 ? '#EFF6FF' : '#FFF7ED' }]}>
                                                    <Text style={{ fontSize: 20 }}>
                                                        {domain.icon === 'car' ? '🚗' :
                                                            domain.icon === 'home' ? '🏠' : '💻'}
                                                    </Text>
                                                </View>
                                                <Text style={styles.gridLabel}>{domain.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </ScrollView>
                        )}
                    </View>

                    {/* Filter Modal */}
                    <FilterModal
                        visible={filterModalVisible}
                        onClose={() => setFilterModalVisible(false)}
                        onApply={(newFilters) => {
                            setAdvancedFilters(newFilters);
                        }}
                        currentFilters={advancedFilters}
                    />

                    {/* Map Picker Modal */}
                    <MapPickerModal
                        visible={isMapModalVisible}
                        onClose={() => setIsMapModalVisible(false)}
                        onConfirm={(loc) => {
                            // loc is { lat, lng, address, ... }
                            selectLocation(loc.lat, loc.lng, loc.address);
                            setIsMapModalVisible(false);
                        }}
                    />
                </View>
            </TouchableWithoutFeedback>
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
        paddingTop: 10,
        paddingBottom: 5,
    },
    addressIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        backgroundColor: '#F3F4F6',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    addressText: {
        fontSize: 12,
        color: '#6B7280',
        marginLeft: 4,
        fontWeight: '500',
        maxWidth: 250,
    },
    pageTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#111',
        letterSpacing: -0.5,
    },
    searchContainer: {
        paddingHorizontal: 20,
        marginVertical: 15,
        flexDirection: 'row',
        alignItems: 'center',
    },
    inputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        height: 52,
        borderRadius: 16,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    inputWrapperFocused: {
        backgroundColor: '#fff',
        borderColor: Colors.light.primary,
        ...Layout.shadows.small,
    },
    input: {
        flex: 1,
        marginLeft: 10,
        fontSize: 16,
        color: '#111',
        height: '100%',
    },
    clearBtn: {
        backgroundColor: '#D1D5DB',
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterBtn: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    filterBtnActive: {
        backgroundColor: Colors.light.primary,
        borderColor: Colors.light.primary,
    },
    filterRow: {
        marginBottom: 10,
        height: 40,
    },
    // New Address Picker Styles
    addressPickerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        marginBottom: 15,
        marginTop: -5,
        backgroundColor: '#F9FAFB',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    addressPickerText: {
        flex: 1,
        fontSize: 13,
        color: '#4B5563',
        marginLeft: 8,
        marginRight: 8,
    },
    changeText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.light.primary,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginRight: 8,
        height: 36,
    },
    filterChipActive: {
        backgroundColor: Colors.light.primary,
        borderColor: Colors.light.primary,
    },
    filterText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#666',
    },
    filterTextActive: {
        color: '#fff',
    },
    body: {
        flex: 1,
        backgroundColor: '#FAFAFA',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        overflow: 'hidden',
    },
    scrollContent: {
        padding: 24,
    },
    section: {
        marginBottom: 32,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
    },
    clearText: {
        fontSize: 13,
        color: '#EF4444',
        fontWeight: '600',
    },
    historyList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    historyText: {
        fontSize: 14,
        color: '#4B5563',
        marginRight: 8,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    gridCard: {
        width: '48%',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        alignItems: 'center',
        ...Layout.shadows.small,
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    gridLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111',
    },
    resultsList: {
        padding: 20,
    },
    resultCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
        alignItems: 'center',
        ...Layout.shadows.small,
    },
    resultImage: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#F3F4F6',
    },
    resultContent: {
        flex: 1,
        marginLeft: 12,
    },
    resultHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    resultName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111',
        maxWidth: '90%',
    },
    onlineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10B981',
    },
    resultCategory: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    ratingText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#B45309',
        marginLeft: 3,
    },
    locationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    distanceText: {
        fontSize: 11,
        color: '#6B7280',
        marginLeft: 3,
    },
    dot: {
        fontSize: 16,
        color: '#D1D5DB',
        marginHorizontal: 8,
    },
    priceText: {
        fontSize: 11,
        color: '#15803D', // Greenish for price
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#374151',
        marginTop: 16,
    },
    emptySub: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 8,
    },
});
