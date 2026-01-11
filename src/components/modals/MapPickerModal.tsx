import { GooglePlacesInput } from '@/components/GooglePlacesInput';
import { Colors } from '@/constants/Colors';
import { useLocation } from '@/context/LocationContext';
import { useGooglePlaces } from '@/hooks/useGooglePlaces';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    const insets = useSafeAreaInsets();
    const { selectedLocation, searchAddress } = useLocation();
    const { searchPlaces, predictions, getPlaceDetails, reverseGeocode, isLoading: isPlacesLoading } = useGooglePlaces();

    const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lng: number }>(
        initialLocation ||
        (selectedLocation ? { lat: selectedLocation.latitude, lng: selectedLocation.longitude } : null) ||
        { lat: -8.7612, lng: -63.9004 } // Porto Velho default
    );

    const [previewAddress, setPreviewAddress] = useState<string>('Toque no mapa para definir o local');
    const [addressComponents, setAddressComponents] = useState<{
        street?: string;
        number?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
    }>({});
    const [isGeocoding, setIsGeocoding] = useState(false);

    // Manual Input State
    const [isEditing, setIsEditing] = useState(false);

    // Initial reverse geocoding when modal opens
    useEffect(() => {
        if (visible) {
            handleReverseGeocode(selectedPosition.lat, selectedPosition.lng);
        }
    }, [visible]);

    const handleReverseGeocode = async (lat: number, lng: number) => {
        setIsGeocoding(true);
        const result = await reverseGeocode(lat, lng);
        if (result) {
            setPreviewAddress(result.address);
            setAddressComponents({
                street: result.street,
                number: result.number,
                neighborhood: result.neighborhood,
                city: result.city,
                state: result.state
            });
        } else {
            setPreviewAddress('Endereço não encontrado');
            setAddressComponents({});
        }
        setIsGeocoding(false);
    };

    const handleMapPress = (event: any) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;
        setSelectedPosition({ lat: latitude, lng: longitude });
        handleReverseGeocode(latitude, longitude);
        setIsEditing(false); // Close edit mode if touching map
        Keyboard.dismiss();
    };

    const handlePredictionSelect = async (placeId: string, primaryText: string) => {
        Keyboard.dismiss();
        setIsEditing(false); // Temporarily close to show map moving? Or keep open? Let's close.
        setIsGeocoding(true);

        const details = await getPlaceDetails(placeId);

        if (details && details.location) {
            const { location, formattedAddress } = details;

            // Extract some basic components if possible or just use formatted
            // Note: Google Places "address_components" are returned if we asked for them.

            const newPos = { lat: location.latitude, lng: location.longitude };
            setSelectedPosition(newPos);
            setPreviewAddress(formattedAddress);

            // Re-fetch structured components via reverse geocode to ensure uniformity
            handleReverseGeocode(location.latitude, location.longitude);

        } else {
            setPreviewAddress('Erro ao buscar detalhes do local');
            setIsGeocoding(false);
        }
    };

    const mapRef = useRef<MapView>(null);
    useEffect(() => {
        if (mapRef.current && selectedPosition) {
            mapRef.current.animateToRegion({
                latitude: selectedPosition.lat,
                longitude: selectedPosition.lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            }, 500);
        }
    }, [selectedPosition]);

    const handleConfirm = () => {
        // optimistically close first to avoid animation stutter/black screen
        onClose();

        setTimeout(() => {
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
        }, 200);
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
            <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
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
                        ref={mapRef}
                        style={styles.map}
                        provider={Platform.OS === 'android' || Platform.OS === 'ios' ? PROVIDER_GOOGLE : undefined}
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
                                handleReverseGeocode(latitude, longitude);
                            }}
                            tracksViewChanges={false} // Optimization: Stops constant re-rendering of the marker
                        >
                            <View style={{ width: 50, height: 50, justifyContent: 'center', alignItems: 'center' }}>
                                <Image
                                    source={require('../../../assets/images/wavinghuman.png')}
                                    style={{ width: 50, height: 50 }}
                                    resizeMode="contain"
                                />
                            </View>
                        </Marker>
                    </MapView>

                    {/* Address Preview / Edit Card */}
                    <View style={styles.previewCard}>
                        <View style={styles.previewHeader}>
                            <Text style={styles.previewLabel}>
                                {isEditing ? 'EDITAR ENDEREÇO' : 'LOCAL SELECIONADO'}
                            </Text>
                            {isGeocoding && <ActivityIndicator size="small" color={Colors.light.primary} />}
                            {!isGeocoding && !isEditing && (
                                <TouchableOpacity onPress={() => {
                                    setIsEditing(true);
                                }}>
                                    <Text style={styles.editLink}>Editar</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {isEditing ? (
                            <View style={styles.editContainer}>
                                <GooglePlacesInput
                                    initialValue={previewAddress}
                                    onSelect={handlePredictionSelect}
                                    placeholder="Digite o endereço..."
                                />
                                <View style={styles.editRowBtns}>
                                    <TouchableOpacity
                                        style={styles.cancelEditBtn}
                                        onPress={() => setIsEditing(false)}
                                    >
                                        <Text style={styles.cancelEditText}>Cancelar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity onPress={() => {
                                setIsEditing(true);
                            }}>
                                <Text style={styles.previewAddress} numberOfLines={2}>
                                    {previewAddress}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Footer with Confirm Button */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.confirmButton}
                        onPress={handleConfirm}
                    >
                        <Text style={styles.confirmButtonText}>Confirmar Localização</Text>
                    </TouchableOpacity>
                </View>
            </View>
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
        borderRadius: 16, // Smoother rounded
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
    // New Edit Styles
    editLink: {
        fontSize: 12,
        color: Colors.light.primary,
        fontWeight: '600',
    },
    editContainer: {
        marginTop: 8,
    },
    // Removed old manualInput styles in favor of new component
    editRowBtns: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 10,
        gap: 10,
    },
    cancelEditBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    cancelEditText: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
    },
});
