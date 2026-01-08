import { Colors } from '@/constants/Colors';
import { BRANDED_MAP_STYLE } from '@/constants/MapStyles';
import { useLocation } from '@/context/LocationContext';
import * as Location from 'expo-location';
import { Briefcase, ChevronLeft, Home, MapPin, Navigation, Search, Star, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');


interface AddressSelectionModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function AddressSelectionModal({ visible, onClose }: AddressSelectionModalProps) {
    const {
        location: gpsLocation,
        selectedLocation,
        selectLocation,
        refreshLocation,
        searchAddress,
        address: currentAddress,
        savedAddresses
    } = useLocation();

    const insets = useSafeAreaInsets();
    const [viewMode, setViewMode] = useState<'LIST' | 'MAP_PICKER'>('LIST');
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState<{ latitude: number, longitude: number, address: string }[]>([]);
    const [searching, setSearching] = useState(false);
    const [pickerRegion, setPickerRegion] = useState({
        latitude: selectedLocation?.latitude || gpsLocation?.coords.latitude || -8.76183,
        longitude: selectedLocation?.longitude || gpsLocation?.coords.longitude || -63.90177,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
    });
    const [pickerAddress, setPickerAddress] = useState('Centralizando...');
    const mapRef = useRef<MapView>(null);

    // Reset view when opening
    useEffect(() => {
        if (visible) {
            setViewMode('LIST');
            setSearchText('');
            setSearchResults([]);
        }
    }, [visible]);

    // Handle search input with debounce
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchText.length > 3) {
                setSearching(true);
                const results = await searchAddress(searchText);
                setSearchResults(results);
                setSearching(false);
            } else {
                setSearchResults([]);
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [searchText]);

    const handleSelectSaved = (saved: any) => {
        selectLocation(saved.latitude, saved.longitude, saved.address);
        onClose();
    };

    const handleUseCurrentLocation = async () => {
        await refreshLocation(true); // This triggers context to update selectedLocation to GPS
        onClose();
    };

    const handleConfirmPicker = () => {
        selectLocation(pickerRegion.latitude, pickerRegion.longitude, pickerAddress);
        onClose();
    };

    const handleSearchResultSelect = (result: any) => {
        setPickerRegion({
            ...pickerRegion,
            latitude: result.latitude,
            longitude: result.longitude,
        });
        setPickerAddress(result.address);
        setViewMode('MAP_PICKER');

        // Ensure map animates to the new location
        setTimeout(() => {
            mapRef.current?.animateToRegion({
                latitude: result.latitude,
                longitude: result.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            }, 1000);
        }, 100);
    };

    // Reverse geocode whenever picker region changes (drag ends)
    const onRegionChangeComplete = async (region: any) => {
        setPickerRegion(region);
        try {
            const reverse = await Location.reverseGeocodeAsync({ latitude: region.latitude, longitude: region.longitude });
            if (reverse.length > 0) {
                const place = reverse[0];
                const street = place.street || place.name || '';
                const number = place.streetNumber || '';
                const district = place.district || place.subregion || '';
                const city = place.city || '';

                let formatted = `${street}${number ? `, ${number}` : ''}`;
                if (district && district !== street) formatted += ` - ${district}`;
                if (city && !formatted.includes(city)) formatted += `, ${city}`;

                setPickerAddress(formatted);
            }
        } catch (e) {
            setPickerAddress('Endereço desconhecido');
        }
    };

    const renderHeader = () => (
        <View style={styles.header}>
            {viewMode === 'MAP_PICKER' ? (
                <TouchableOpacity onPress={() => setViewMode('LIST')} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.light.text} />
                </TouchableOpacity>
            ) : <View style={{ width: 24 }} />}

            <Text style={styles.headerTitle}>
                {viewMode === 'LIST' ? 'Onde será o serviço?' : 'Confirmar Localização'}
            </Text>

            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={Colors.light.textSecondary} />
            </TouchableOpacity>
        </View>
    );

    const renderSearchBar = () => (
        <View style={styles.searchContainer}>
            {searching ? (
                <View style={[styles.searchIcon, { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }]}>
                    {/* Simple loading dot for now */}
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.light.primary }} />
                </View>
            ) : (
                <Search size={20} color={Colors.light.textSecondary} style={styles.searchIcon} />
            )}
            <TextInput
                style={styles.searchInput}
                placeholder="Buscar endereço e número"
                placeholderTextColor="#94A3B8"
                value={searchText}
                onChangeText={setSearchText}
                autoCorrect={false}
                clearButtonMode="while-editing"
            />
        </View>
    );

    const renderSearchBarTitle = () => {
        if (searchText.length > 0) return null;
        return <Text style={styles.sectionTitle}>Endereços Salvos</Text>;
    };

    const renderSearchResults = () => (
        <FlatList
            data={searchResults}
            keyExtractor={(item, index) => `search-${index}`}
            renderItem={({ item }) => (
                <TouchableOpacity style={styles.searchResultItem} onPress={() => handleSearchResultSelect(item)}>
                    <View style={styles.searchResultIcon}>
                        <MapPin size={18} color={Colors.light.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.searchResultText} numberOfLines={2}>{item.address}</Text>
                    </View>
                </TouchableOpacity>
            )}
            style={{ flex: 1 }}
        />
    );

    const renderSavedItem = ({ item }: { item: any }) => {
        const Icon = item.icon === 'Home' ? Home : item.icon === 'Briefcase' ? Briefcase : Star;
        return (
            <TouchableOpacity style={styles.savedItem} onPress={() => handleSelectSaved(item)}>
                <View style={styles.savedIconContainer}>
                    <Icon size={20} color={Colors.light.primary} />
                </View>
                <View>
                    <Text style={styles.savedName}>{item.name}</Text>
                    <Text style={styles.savedAddress}>{item.address}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
            <View style={[styles.safeArea, { paddingTop: Math.max(insets.top, 20) }]}>
                {renderHeader()}

                {viewMode === 'LIST' ? (
                    <View style={styles.content}>
                        {renderSearchBar()}

                        {searchText.length > 0 ? (
                            renderSearchResults()
                        ) : (
                            <>
                                <TouchableOpacity style={styles.currentLocationRow} onPress={handleUseCurrentLocation}>
                                    <View style={[styles.savedIconContainer, { backgroundColor: 'rgba(253, 123, 5, 0.1)' }]}>
                                        <Navigation size={20} color={Colors.light.primary} />
                                    </View>
                                    <Text style={styles.currentLocationText}>Usar localização atual</Text>
                                </TouchableOpacity>

                                {renderSearchBarTitle()}
                                <FlatList
                                    data={savedAddresses}
                                    renderItem={renderSavedItem}
                                    keyExtractor={item => item.id}
                                    contentContainerStyle={{ paddingBottom: 20 }}
                                />
                            </>
                        )}

                        {searchText.length === 0 && (
                            <TouchableOpacity style={styles.mapPickerButton} onPress={() => setViewMode('MAP_PICKER')}>
                                <MapPin size={20} color="#fff" />
                                <Text style={styles.mapPickerButtonText}>Selecionar no Mapa</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <View style={styles.pickerContainer}>
                        <MapView
                            ref={mapRef}
                            style={StyleSheet.absoluteFillObject}
                            initialRegion={pickerRegion}
                            onRegionChangeComplete={onRegionChangeComplete}
                            provider={PROVIDER_GOOGLE}
                            customMapStyle={BRANDED_MAP_STYLE}

                            userInterfaceStyle="light"
                        />
                        {/* Fixed Pin in Center */}
                        <View style={styles.fixedPinContainer}>
                            <View style={styles.pinBubble}>
                                <Home size={20} color="#fff" fill="#fff" />
                            </View>
                            <View style={styles.pinStick} />
                        </View>

                        <View style={styles.pickerFooter}>
                            <Text style={styles.pickerLabel}>Endereço selecionado</Text>
                            <Text style={styles.pickerAddress} numberOfLines={2}>{pickerAddress}</Text>
                            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmPicker}>
                                <Text style={styles.confirmButtonText}>Confirmar este local</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.light.text,
    },
    backButton: {
        padding: 4,
    },
    closeButton: {
        padding: 4,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 20,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: Colors.light.text,
    },
    currentLocationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
        paddingVertical: 8,
    },
    currentLocationText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.light.primary,
        marginLeft: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#94A3B8',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    savedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingVertical: 8,
    },
    savedIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    savedName: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.light.text,
        marginBottom: 2,
    },
    savedAddress: {
        fontSize: 13,
        color: Colors.light.textSecondary,
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    searchResultIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    searchResultText: {
        fontSize: 15,
        color: Colors.light.text,
        lineHeight: 20,
    },
    mapPickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.primary,
        paddingVertical: 14,
        borderRadius: 30,
        marginBottom: 20,
    },
    mapPickerButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    pickerContainer: {
        flex: 1,
        position: 'relative',
    },
    fixedPinContainer: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginLeft: -24,
        marginTop: -48,
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none', // Allow map interaction through the pin
    },
    pinBubble: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.light.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
    },
    pinStick: {
        width: 4,
        height: 24,
        backgroundColor: Colors.light.primary,
        borderRadius: 2,
        marginTop: -2,
    },
    pickerFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        padding: 24,
        paddingBottom: 40,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    pickerLabel: {
        fontSize: 12,
        color: Colors.light.textSecondary,
        marginBottom: 4,
    },
    pickerAddress: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginBottom: 20,
    },
    confirmButton: {
        backgroundColor: Colors.light.primary,
        paddingVertical: 16,
        borderRadius: 30,
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
