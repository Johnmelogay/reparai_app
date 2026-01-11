import { Colors } from '@/constants/Colors';
import { useGooglePlaces } from '@/hooks/useGooglePlaces';
import React, { useState } from 'react';
import { ActivityIndicator, ReturnKeyTypeOptions, StyleSheet, Text, TextInput, TouchableOpacity, View, ViewStyle } from 'react-native';

interface GooglePlacesInputProps {
    placeholder?: string;
    onSelect: (placeId: string, primaryText: string) => void;
    containerStyle?: ViewStyle;
    inputStyle?: any; // Relaxed type to avoid mismatch
    initialValue?: string;
    value?: string;
    onChangeText?: (text: string) => void;
    onSubmitEditing?: () => void;
    returnKeyType?: ReturnKeyTypeOptions;
}

import { useLocation } from '@/context/LocationContext'; // New import

// ... props interface ...

export function GooglePlacesInput({
    placeholder = "Buscar endereço...",
    onSelect,
    containerStyle,
    inputStyle,
    initialValue = '',
    value,
    onChangeText,
    onSubmitEditing,
    returnKeyType = 'default'
}: GooglePlacesInputProps) {
    const { searchPlaces, predictions, isLoading } = useGooglePlaces();
    const { selectedLocation, location } = useLocation(); // Get current location for bias fallback
    const [internalQuery, setInternalQuery] = useState(initialValue);
    const [isFocused, setIsFocused] = useState(false);

    // Determine effective value (Controlled vs Uncontrolled)
    const query = value !== undefined ? value : internalQuery;

    const handleChange = (text: string) => {
        if (value === undefined) {
            setInternalQuery(text);
        }
        if (onChangeText) {
            onChangeText(text);
        }

        // Pass location bias: Prefer selected map location, fallback to device GPS
        const biasLat = selectedLocation?.latitude || location?.coords.latitude;
        const biasLng = selectedLocation?.longitude || location?.coords.longitude;

        if (biasLat && biasLng) {
            searchPlaces(text, { latitude: biasLat, longitude: biasLng });
        } else {
            searchPlaces(text);
        }
    };

    const handleSelect = (placeId: string, text: string) => {
        if (value === undefined) {
            setInternalQuery(text);
        }
        // If controlled, parent handles value update via onSelect side-effect if needed, 
        // or we just call onSelect and let parent decide.
        // Usually, autocomplete fills the input.
        if (onChangeText) {
            // Optional: Update text to match selection?
            // onChangeText(text); 
            // We usually want to reflect the selected address name
        }

        onSelect(placeId, text);
        setIsFocused(false); // Close suggestions
    };

    return (
        <View style={[styles.container, containerStyle]}>
            <View style={[styles.inputWrapper, isFocused && styles.inputFocused]}>
                <TextInput
                    style={[styles.input, inputStyle]}
                    value={query}
                    onChangeText={handleChange}
                    placeholder={placeholder}
                    placeholderTextColor="#999"
                    onFocus={() => setIsFocused(true)}
                    // onBlur={() => setIsFocused(false)} // Keep open to allow clicking list
                    onSubmitEditing={onSubmitEditing}
                    returnKeyType={returnKeyType}
                />
                {isLoading && <ActivityIndicator size="small" color={Colors.light.primary} style={{ marginRight: 10 }} />}
            </View>

            {/* Suggestions Overlay */}
            {isFocused && (isLoading || predictions.length > 0 || (query.length >= 3 && !isLoading)) && (
                <View style={styles.listContainer}>
                    {isLoading && (
                        <View style={styles.statusItem}>
                            <ActivityIndicator size="small" color={Colors.light.primary} />
                            <Text style={styles.statusText}>Buscando...</Text>
                        </View>
                    )}

                    {!isLoading && predictions.length === 0 && query.length >= 3 && (
                        <View style={styles.statusItem}>
                            <Text style={styles.statusText}>Nenhum endereço encontrado</Text>
                        </View>
                    )}

                    {!isLoading && predictions.map((p) => (
                        <TouchableOpacity
                            key={p.placePrediction.placeId}
                            style={styles.item}
                            onPress={() => handleSelect(p.placePrediction.placeId, p.placePrediction.structuredFormat.mainText.text)}
                        >
                            <Text style={styles.mainText}>{p.placePrediction.structuredFormat.mainText.text}</Text>
                            <Text style={styles.secondaryText}>
                                {p.placePrediction.structuredFormat.secondaryText?.text || 'Endereço indisponível'}
                            </Text>
                        </TouchableOpacity>
                    ))}

                    {/* Attribution */}
                    <View style={styles.poweredBy}>
                        <Text style={styles.poweredText}>Powered by Google</Text>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        zIndex: 999, // Ensure suggestions float above
    },
    inputWrapper: {
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E5EA',
        flexDirection: 'row',
        alignItems: 'center',
        height: 50,
    },
    inputFocused: {
        borderColor: Colors.light.primary,
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
    },
    input: {
        flex: 1,
        paddingHorizontal: 15,
        fontSize: 16,
        color: '#333',
        height: '100%',
    },
    listContainer: {
        position: 'absolute',
        top: 55, // Below input
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f0f0f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
        overflow: 'hidden',
    },
    item: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f9f9f9',
    },
    mainText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111',
    },
    secondaryText: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    poweredBy: {
        padding: 8,
        backgroundColor: '#f9f9f9',
        alignItems: 'flex-end',
    },
    poweredText: {
        fontSize: 10,
        color: '#aaa',
    },
    statusItem: {
        padding: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusText: {
        marginLeft: 10,
        fontSize: 14,
        color: '#666',
    }
});
