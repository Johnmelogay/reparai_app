/**
 * File: src/context/LocationContext.tsx
 * Purpose: Manages User Location and Address Selection.
 * Key Features:
 * - Tracks current device geolocation (latitude/longitude).
 * - Manages the "Selected Address" (where the service is needed).
 * - Persists selected location to AsyncStorage for app restarts.
 * - formatting and reverse geocoding utilities.
 */
import { supabase } from '@/services/supabase';
import { getItem, saveItem, STORAGE_KEYS } from '@/utils/storage';
import * as Location from 'expo-location';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';

export interface SavedAddress {
    id: string;
    name: string; // e.g., "Casa", "Trabalho"
    address: string;
    latitude: number;
    longitude: number;
    streetNumber?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    icon: string; // lucide icon name
}

interface LocationContextType {
    location: Location.LocationObject | null; // Raw GPS
    selectedLocation: {
        latitude: number;
        longitude: number;
        address: string;
        streetNumber?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
    } | null; // User choice
    address: string; // Display address
    errorMsg: string | null;
    isLoading: boolean;
    refreshLocation: (updateServiceAddress?: boolean) => Promise<Location.LocationObject | null>;
    selectLocation: (lat: number, long: number, addr?: string, components?: Partial<any>) => void;
    searchAddress: (query: string) => Promise<{ latitude: number, longitude: number, address: string }[]>;
    savedAddresses: SavedAddress[];
    saveAddress: (address: Omit<SavedAddress, 'id'>) => Promise<void>;
    deleteAddress: (id: string) => Promise<void>;
    fetchSavedAddresses: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider = ({ children }: { children: ReactNode }) => {
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<{
        latitude: number;
        longitude: number;
        address: string;
        streetNumber?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
    } | null>(null);
    const [address, setAddress] = useState<string>('Localizando...');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);

    const fetchSavedAddresses = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('clients')
                .select('saved_addresses')
                .eq('id', user.id)
                .single();

            if (data?.saved_addresses) {
                // Ensure it's an array and parse it if necessary (Supabase returns JSON object/array directly)
                const addresses = Array.isArray(data.saved_addresses) ? data.saved_addresses : [];
                setSavedAddresses(addresses);
            }
        } catch (err) {
            console.error('Error fetching saved addresses:', err);
        }
    };

    const saveAddress = async (newAddress: Omit<SavedAddress, 'id'>) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Erro', 'Você precisa estar logado para salvar endereços.');
                return;
            }

            const addressWithId = { ...newAddress, id: Math.random().toString(36).substring(7) };
            const updatedAddresses = [...savedAddresses, addressWithId];

            const { error } = await supabase
                .from('clients')
                .update({ saved_addresses: updatedAddresses })
                .eq('id', user.id);

            if (error) throw error;

            setSavedAddresses(updatedAddresses);
            Alert.alert('Sucesso', 'Endereço salvo com sucesso!');
        } catch (err) {
            console.error('Error saving address:', err);
            Alert.alert('Erro', 'Não foi possível salvar o endereço.');
        }
    };

    const deleteAddress = async (id: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const updatedAddresses = savedAddresses.filter(addr => addr.id !== id);

            const { error } = await supabase
                .from('clients')
                .update({ saved_addresses: updatedAddresses })
                .eq('id', user.id);

            if (error) throw error;

            setSavedAddresses(updatedAddresses);
        } catch (err) {
            console.error('Error deleting address:', err);
            Alert.alert('Erro', 'Não foi possível remover o endereço.');
        }
    };

    const selectLocation = (latitude: number, longitude: number, addr?: string, components?: Partial<typeof selectedLocation>) => {
        const newLoc = {
            latitude,
            longitude,
            address: addr || 'Local selecionado',
            ...components
        };
        setSelectedLocation(newLoc);
        saveItem(STORAGE_KEYS.SELECTED_LOCATION, newLoc);

        if (addr) setAddress(addr);
        else reverseGeocode(latitude, longitude);
    };

    const reverseGeocode = async (latitude: number, longitude: number) => {
        try {
            const reverseGeocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (reverseGeocoded.length > 0) {
                const place = reverseGeocoded[0];
                const street = place.street || place.name || '';
                const number = place.streetNumber || '';
                const district = place.district || place.subregion || '';
                const city = place.city || '';

                let formattedAddress = `${street}${number ? `, ${number}` : ''}`;
                if (district && district !== street) formattedAddress += ` - ${district}`;
                if (city && !formattedAddress.includes(city)) formattedAddress += `, ${city}`;

                setAddress(formattedAddress);

                const locationToSave = {
                    latitude,
                    longitude,
                    address: formattedAddress,
                    streetNumber: number,
                    neighborhood: district,
                    city: city,
                    state: place.region || '',
                };

                setSelectedLocation(locationToSave);
                saveItem(STORAGE_KEYS.SELECTED_LOCATION, locationToSave);
            } else {
                setAddress('Endereço não encontrado');
            }
        } catch (geoError) {
            console.warn("Reverse geocoding failed", geoError);
            setAddress('Endereço não disponível');
        }
    };

    const searchAddress = async (query: string) => {
        if (!query.trim()) return [];
        try {
            const results = await Location.geocodeAsync(query);
            const formattedResults = await Promise.all(results.map(async (res) => {
                const reverseResult = await Location.reverseGeocodeAsync({ latitude: res.latitude, longitude: res.longitude });
                let addr = query;
                if (reverseResult.length > 0) {
                    const p = reverseResult[0];
                    const street = p.street || p.name || '';
                    const number = p.streetNumber || '';
                    const district = p.district || '';
                    const city = p.city || '';
                    const state = p.region || '';
                    addr = `${street}${number ? `, ${number}` : ''}${district ? ` - ${district}` : ''}${city ? `, ${city}` : ''}`;

                    return {
                        latitude: res.latitude,
                        longitude: res.longitude,
                        address: addr,
                        streetNumber: number,
                        neighborhood: district,
                        city: city,
                        state: state
                    };
                }
                return {
                    latitude: res.latitude,
                    longitude: res.longitude,
                    address: addr
                };
            }));
            return formattedResults;
        } catch (error) {
            console.error("Geocoding failed", error);
            return [];
        }
    };

    const refreshLocation = async (updateServiceAddress: boolean = false): Promise<Location.LocationObject | null> => {
        setIsLoading(true);
        setErrorMsg(null);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setErrorMsg('Permissão de localização negada');
                setAddress('Localização indisponível');
                setIsLoading(false);
                return null;
            }

            let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

            // [DEV] Override removed for production/device testing
            console.log('📍 Location updated:', location.coords.latitude, location.coords.longitude);

            setLocation(location);

            // ONLY update service address if explicitly requested (e.g. first load or "use current location" button)
            if (updateServiceAddress) {
                setSelectedLocation({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    address: '' // Will be filled by reverseGeocode
                });
                await reverseGeocode(location.coords.latitude, location.coords.longitude);
            }

            return location;

        } catch (error) {
            setErrorMsg('Erro ao obter localização');
            Alert.alert('Erro', 'Não foi possível obter sua localização atual.');
            if (updateServiceAddress) setAddress('Localização indisponível');
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Hydrate from storage
        const hydrate = async () => {
            const savedLoc = await getItem<typeof selectedLocation>(STORAGE_KEYS.SELECTED_LOCATION);
            if (savedLoc) {
                setSelectedLocation(savedLoc);
                setAddress(savedLoc.address);
            }
            // Always get live GPS location on startup (don't update service address if we have one)
            refreshLocation(!savedLoc);

            // Hydrate saved addresses
            fetchSavedAddresses();
        };

        hydrate();
    }, []);

    return (
        <LocationContext.Provider value={{
            location,
            selectedLocation,
            address,
            errorMsg,
            isLoading,
            refreshLocation,
            selectLocation,
            searchAddress,
            savedAddresses,
            saveAddress,
            deleteAddress,
            fetchSavedAddresses
        }}>
            {children}
        </LocationContext.Provider>
    );
};

export const useLocation = () => {
    const context = useContext(LocationContext);
    if (context === undefined) {
        throw new Error('useLocation must be used within a LocationProvider');
    }
    return context;
};
