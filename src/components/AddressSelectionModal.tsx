import { GooglePlacesInput } from '@/components/GooglePlacesInput';
import { MapPickerModal } from '@/components/modals/MapPickerModal';
import { Colors } from '@/constants/Colors';
import { useLocation } from '@/context/LocationContext';
import { useGooglePlaces } from '@/hooks/useGooglePlaces';
import { Briefcase, Home, MapPin, Navigation, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Dimensions, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
        savedAddresses,
        saveAddress
    } = useLocation();

    const insets = useSafeAreaInsets();
    const { getPlaceDetails } = useGooglePlaces();
    const [searchText, setSearchText] = useState('');
    const [mapPickerVisible, setMapPickerVisible] = useState(false);

    // Save flow state
    const [showSaveFlow, setShowSaveFlow] = useState(false);
    const [selectedIcon, setSelectedIcon] = useState<'Home' | 'Briefcase' | 'MapPin' | null>(null);
    const [addressName, setAddressName] = useState('');

    // Reset when opening
    useEffect(() => {
        if (visible) {
            setSearchText('');
            setShowSaveFlow(false);
            setSelectedIcon(null);
            setAddressName('');
        }
    }, [visible]);

    const handleSelectSaved = (saved: any) => {
        selectLocation(saved.latitude, saved.longitude, saved.address);
        onClose();
    };

    const handleUseCurrentLocation = async () => {
        await refreshLocation(true); // This triggers context to update selectedLocation to GPS
        onClose();
    };


    const handleSearchResultSelect = async (placeId: string, text: string) => {
        setSearchText(text);
        const details = await getPlaceDetails(placeId);
        if (details) {
            selectLocation(details.location.latitude, details.location.longitude, details.formattedAddress);
            // Don't close immediately - let user save if they want
        }
    };

    const handleStartSaveFlow = () => {
        setShowSaveFlow(true);
    };

    const handleIconSelect = (icon: 'Home' | 'Briefcase' | 'MapPin') => {
        setSelectedIcon(icon);
        // Auto-fill name based on icon
        const defaultNames = {
            'Home': 'Casa',
            'Briefcase': 'Trabalho',
            'MapPin': 'Meu Local'
        };
        setAddressName(defaultNames[icon]);
    };

    const handleSaveAddress = async () => {
        if (!selectedLocation || !selectedIcon || !addressName.trim()) return;

        await saveAddress({
            name: addressName,
            address: selectedLocation.address,
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
            streetNumber: selectedLocation.streetNumber,
            neighborhood: selectedLocation.neighborhood,
            city: selectedLocation.city,
            state: selectedLocation.state,
            icon: selectedIcon
        });

        // Reset and close
        setShowSaveFlow(false);
        setSelectedIcon(null);
        setAddressName('');
        onClose();
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={{ width: 24 }} />

            <Text style={styles.headerTitle}>
                Onde será o serviço?
            </Text>

            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={Colors.light.textSecondary} />
            </TouchableOpacity>
        </View>
    );

    const renderSearchBar = () => (
        <View style={{ marginBottom: 20, zIndex: 10 }}>
            <GooglePlacesInput
                value={searchText}
                onChangeText={setSearchText}
                onSelect={handleSearchResultSelect}
                placeholder="Buscar endereço e número"
            />
        </View>
    );

    const renderSearchBarTitle = () => {
        return <Text style={styles.sectionTitle}>Endereços Salvos</Text>;
    };

    const renderAddressPreview = () => {
        if (!selectedLocation) return null;

        return (
            <View style={styles.addressPreviewCard}>
                <View style={styles.addressPreviewHeader}>
                    <View style={styles.addressPreviewIconLarge}>
                        <MapPin size={22} color="#6B7280" strokeWidth={2.5} />
                    </View>
                    <Text style={styles.addressPreviewLabel}>Endereço selecionado</Text>
                </View>
                <Text style={styles.addressPreviewAddress} numberOfLines={2}>
                    {selectedLocation.address}
                </Text>
            </View>
        );
    };

    const renderSaveButton = () => {
        if (!selectedLocation || showSaveFlow) return null;

        return (
            <TouchableOpacity style={styles.primaryButton} onPress={handleStartSaveFlow}>
                <Text style={styles.primaryButtonText}>Salvar este endereço</Text>
            </TouchableOpacity>
        );
    };

    const renderIconPicker = () => {
        if (!showSaveFlow) return null;

        const icons: Array<{ key: 'Home' | 'Briefcase' | 'MapPin', label: string, icon: any }> = [
            { key: 'Home', label: 'Casa', icon: Home },
            { key: 'Briefcase', label: 'Trabalho', icon: Briefcase },
            { key: 'MapPin', label: 'Pin', icon: MapPin }
        ];

        return (
            <View style={styles.iconPickerContainer}>
                <Text style={styles.iconPickerTitle}>Escolha um ícone para salvar</Text>
                <View style={styles.iconRow}>
                    {icons.map((item) => {
                        const IconComponent = item.icon;
                        const isSelected = selectedIcon === item.key;
                        return (
                            <TouchableOpacity
                                key={item.key}
                                style={[styles.iconChip, isSelected && styles.iconChipSelected]}
                                onPress={() => handleIconSelect(item.key)}
                            >
                                <IconComponent size={20} color={isSelected ? '#fff' : Colors.light.primary} />
                                <Text style={[styles.iconChipText, isSelected && styles.iconChipTextSelected]}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {selectedIcon && (
                    <View style={{ marginTop: 16 }}>
                        <Text style={styles.inputLabel}>Nome do endereço</Text>
                        <TextInput
                            style={styles.nameInput}
                            value={addressName}
                            onChangeText={setAddressName}
                            placeholder="Ex: Casa de Praia"
                            placeholderTextColor="#999"
                        />
                        <TouchableOpacity style={styles.confirmSaveButton} onPress={handleSaveAddress}>
                            <Text style={styles.confirmSaveButtonText}>Confirmar</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    const renderSavedItem = ({ item }: { item: any }) => {
        const Icon = item.icon === 'Home' ? Home : item.icon === 'Briefcase' ? Briefcase : MapPin;
        return (
            <TouchableOpacity
                style={styles.savedItemCard}
                onPress={() => handleSelectSaved(item)}
                activeOpacity={0.7}
            >
                <View style={styles.savedItemIcon}>
                    <Icon size={22} color="#6B7280" strokeWidth={2.2} />
                </View>
                <View style={styles.savedItemContent}>
                    <Text style={styles.savedItemName}>{item.name}</Text>
                    <Text style={styles.savedItemAddress} numberOfLines={1}>{item.address}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
            <View style={[styles.safeArea, { paddingTop: Math.max(insets.top, 20) }]}>
                {renderHeader()}

                <View style={styles.content}>
                    {renderSearchBar()}

                    {/* Only show these if NOT in save flow */}
                    {!showSaveFlow && (
                        <>
                            {renderAddressPreview()}
                            {renderSaveButton()}

                            <View style={styles.sectionDivider} />

                            <TouchableOpacity
                                style={styles.locationButton}
                                onPress={handleUseCurrentLocation}
                                activeOpacity={0.7}
                            >
                                <View style={styles.locationButtonIcon}>
                                    <Navigation size={20} color={Colors.light.accent} strokeWidth={2.5} />
                                </View>
                                <Text style={styles.locationButtonText}>Usar minha localização atual</Text>
                            </TouchableOpacity>

                            <View style={styles.sectionDivider} />

                            <Text style={styles.sectionHeader}>Meus endereços</Text>
                            <FlatList
                                data={savedAddresses}
                                renderItem={renderSavedItem}
                                keyExtractor={item => item.id}
                                contentContainerStyle={{ paddingBottom: 20 }}
                                ListEmptyComponent={
                                    <View style={styles.emptyState}>
                                        <MapPin size={32} color="#D1D5DB" strokeWidth={1.5} />
                                        <Text style={styles.emptyStateText}>Nenhum endereço salvo</Text>
                                    </View>
                                }
                            />
                        </>
                    )}

                    {/* Show icon picker when in save flow */}
                    {renderIconPicker()}

                    {searchText.length === 0 && (
                        <TouchableOpacity style={styles.mapPickerButton} onPress={() => setMapPickerVisible(true)}>
                            <MapPin size={20} color="#fff" />
                            <Text style={styles.mapPickerButtonText}>Selecionar no Mapa</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* New Map Picker Component Logic */}
                <MapPickerModal
                    visible={mapPickerVisible}
                    onClose={() => setMapPickerVisible(false)}
                    onConfirm={(loc: { lat: number, lng: number, address: string }) => {
                        selectLocation(loc.lat, loc.lng, loc.address);
                        setMapPickerVisible(false);
                        onClose(); // Close parent modal too
                    }}
                />
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
        marginBottom: 24,
        paddingVertical: 10,
    },
    currentLocationIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(253, 123, 5, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    currentLocationText: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.light.accent,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#9CA3AF',
        marginBottom: 14,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    emptyText: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        paddingVertical: 32,
        fontStyle: 'italic',
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F1F3',
        marginVertical: 20,
    },
    savedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingVertical: 12,
        paddingHorizontal: 12,
        backgroundColor: '#FAFBFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F0F1F3',
    },
    savedIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(253, 123, 5, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    savedName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 4,
    },
    savedAddress: {
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 18,
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
    // === PREMIUM REDESIGN STYLES ===

    // Address Preview Card
    addressPreviewCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    addressPreviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    addressPreviewIconLarge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    addressPreviewLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        textTransform: 'capitalize',
    },
    addressPreviewAddress: {
        fontSize: 15,
        color: '#111827',
        fontWeight: '500',
        lineHeight: 22,
    },

    // Primary Button (Save Button)
    primaryButton: {
        backgroundColor: Colors.light.primary,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 20,
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 4,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.2,
    },

    // Section Divider
    sectionDivider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 16,
    },

    // Location Button
    locationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 0,
    },
    locationButtonIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    locationButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.light.accent,
        flex: 1,
    },

    // Section Header
    sectionHeader: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
        marginTop: 0,
    },

    // Saved Item Cards
    savedItemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 20,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1,
    },
    savedItemIcon: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    savedItemContent: {
        flex: 1,
    },
    savedItemName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    savedItemAddress: {
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 18,
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
    },
    emptyStateText: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 12,
        fontWeight: '500',
    },

    // Icon Picker Styles (keeping existing good styles)
    iconPickerContainer: {
        backgroundColor: '#FAFBFC',
        padding: 16,
        borderRadius: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    iconPickerTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    iconRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    iconChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
    },
    iconChipSelected: {
        backgroundColor: Colors.light.primary,
        borderColor: Colors.light.primary,
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
    },
    iconChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        marginLeft: 6,
    },
    iconChipTextSelected: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    nameInput: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        color: '#111827',
        marginBottom: 16,
    },
    confirmSaveButton: {
        backgroundColor: Colors.light.primary,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    confirmSaveButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
});
