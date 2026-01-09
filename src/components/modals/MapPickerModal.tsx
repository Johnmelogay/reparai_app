import { Colors } from '@/constants/Colors';
import { useLocation } from '@/context/LocationContext';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

interface MapPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (location: {
        lat: number;
        lng: number;
        address: string;
        street?: string;
        number?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
    }) => void;
    initialLocation?: { lat: number; lng: number };
}

export function MapPickerModal({ visible, onClose, onConfirm, initialLocation }: MapPickerModalProps) {
    const { selectedLocation } = useLocation();

    const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lng: number }>(
        initialLocation ||
        (selectedLocation ? { lat: selectedLocation.latitude, lng: selectedLocation.longitude } : null) ||
        { lat: -8.7612, lng: -63.9004 } // Porto Velho default
    );
    const [isLoading, setIsLoading] = useState(false);
    const [previewAddress, setPreviewAddress] = useState<string>('Toque no mapa para definir o local');
    const [addressComponents, setAddressComponents] = useState<{
        street?: string;
        number?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
    }>({});
    const [isGeocoding, setIsGeocoding] = useState(false);

    // Initial reverse geocoding when modal opens
    useEffect(() => {
        if (visible) {
            fetchAddressPreview(selectedPosition.lat, selectedPosition.lng);
        }
    }, [visible]);

    const fetchAddressPreview = async (lat: number, lng: number) => {
        setIsGeocoding(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
                {
                    headers: {
                        'User-Agent': 'RepairApp/1.0'
                    }
                }
            );
            const data = await response.json();
            if (data && data.address) {
                const addr = data.address;
                const street = addr.road || addr.pedestrian || addr.path || '';
                const neighborhood = addr.suburb || addr.neighbourhood || addr.quarter || '';
                const num = addr.house_number || '';
                const city = addr.city || addr.town || addr.municipality || '';
                const state = addr.state || ''; // Nominatim often returns full state name, handle with care or use as is

                setAddressComponents({ street, number: num, neighborhood, city, state });

                // Format: "Rua X, 123 - Bairro"
                let formatted = `${street}`;
                if (num) formatted += `, ${num}`;
                if (neighborhood) formatted += ` - ${neighborhood}`;
                if (city) formatted += ` - ${city}`;

                setPreviewAddress(formatted || 'Endereço não identificado');
            } else {
                setPreviewAddress('Endereço não encontrado');
                setAddressComponents({});
            }
        } catch (error) {
            setPreviewAddress('Endereço aproximado');
        } finally {
            setIsGeocoding(false);
        }
    };

    const handleMapPress = (event: any) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;
        setSelectedPosition({ lat: latitude, lng: longitude });
        fetchAddressPreview(latitude, longitude);
    };

    const handleConfirm = async () => {
        setIsLoading(true);
        // Extract components from the preview logic if we can, or re-parse/store them. 
        // Since we only stored the string 'previewAddress', we might want to store the raw components too or just re-fetch is overkill.
        // Better: let's re-use the last fetched data if possible, but for now, let's just assume previewAddress is correct string and we might need to parse it or just pass nulls if we didn't save them.
        // Actually, to fully satisfy the user request "fill fields corresponding", we should pass the components we got from Nominatim.
        // Let's refactor `fetchAddressPreview` to store the raw components in a state.

        onConfirm({
            lat: selectedPosition.lat,
            lng: selectedPosition.lng,
            address: previewAddress,
            street: addressComponents.street,
            number: addressComponents.number,
            neighborhood: addressComponents.neighborhood,
            city: addressComponents.city,
            state: addressComponents.state
        });
        setIsLoading(false);
        onClose();
    };

    const initialRegion: Region = {
        latitude: selectedPosition.lat,
        longitude: selectedPosition.lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose}>
                        <Text style={styles.cancelButton}>Cancelar</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Escolher Localização</Text>
                    <View style={{ width: 70 }} />
                </View>

                {/* Map */}
                <View style={styles.mapContainer}>
                    <MapView
                        style={styles.map}
                        provider={PROVIDER_GOOGLE}
                        initialRegion={initialRegion}
                        onPress={handleMapPress}
                        showsUserLocation
                        showsMyLocationButton
                    >
                        <Marker
                            coordinate={{
                                latitude: selectedPosition.lat,
                                longitude: selectedPosition.lng
                            }}
                            draggable
                            onDragEnd={(e) => {
                                const { latitude, longitude } = e.nativeEvent.coordinate;
                                setSelectedPosition({ lat: latitude, lng: longitude });
                                fetchAddressPreview(latitude, longitude);
                            }}
                        >
                            <Image
                                source={require('../../../assets/images/wavinghuman.png')}
                                style={{ width: 50, height: 50 }}
                                resizeMode="contain"
                            />
                        </Marker>
                    </MapView>

                    {/* Address Preview Card */}
                    <View style={styles.previewCard}>
                        <View style={styles.previewHeader}>
                            <Text style={styles.previewLabel}>LOCAL SELECIONADO</Text>
                            {isGeocoding && <ActivityIndicator size="small" color={Colors.light.primary} />}
                        </View>
                        <Text style={styles.previewAddress} numberOfLines={2}>
                            {previewAddress}
                        </Text>
                    </View>
                </View>

                {/* Footer with Confirm Button */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.confirmButton, isLoading && styles.confirmButtonDisabled]}
                        onPress={handleConfirm}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.confirmButtonText}>Confirmar Localização</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        zIndex: 10,
        backgroundColor: '#fff'
    },
    cancelButton: {
        fontSize: 16,
        color: Colors.light.primary,
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        color: '#000',
    },
    mapContainer: {
        flex: 1,
        position: 'relative',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    previewCard: {
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#f0f0f0'
    },
    previewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    previewLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.light.primary,
        letterSpacing: 0.5
    },
    previewAddress: {
        fontSize: 15,
        color: '#333',
        fontWeight: '500',
        lineHeight: 20
    },
    footer: {
        padding: 16,
        paddingBottom: 24,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        backgroundColor: '#fff',
    },
    confirmButton: {
        backgroundColor: Colors.light.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    confirmButtonDisabled: {
        opacity: 0.6,
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
