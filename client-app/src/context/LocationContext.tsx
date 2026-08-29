/**
 * File: src/context/LocationContext.tsx
 * Purpose: Manages User Location and Address Selection with strict privacy separation.
 */
import { supabase } from '@/services/supabase';
import { SavedAddress } from '@/types';
import { getItem, removeItem, saveItem, STORAGE_KEYS } from '@/utils/storage';
import * as Location from 'expo-location';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';

export type LocationSourceType = 'current_gps' | 'saved_address' | 'custom_selection';

export interface SelectedLocationData {
    latitude: number;
    longitude: number;
    address: string;
    name?: string;
    streetNumber?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    sourceType: LocationSourceType;
    isApproximate?: boolean;
}

interface LocationContextType {
    location: Location.LocationObject | null; // Raw GPS
    selectedLocation: SelectedLocationData | null; // User choice
    address: string; // Display address
    locationSourceType: LocationSourceType;
    errorMsg: string | null;
    isLoading: boolean;
    refreshLocation: (updateServiceAddress?: boolean) => Promise<Location.LocationObject | null>;
    selectLocation: (lat: number, long: number, addr?: string, components?: Partial<SelectedLocationData>) => void;
    searchAddress: (query: string) => Promise<{ latitude: number, longitude: number, address: string }[]>;
    savedAddresses: SavedAddress[];
    saveAddress: (address: Omit<SavedAddress, 'id'>) => Promise<void>;
    deleteAddress: (id: string) => Promise<void>;
    fetchSavedAddresses: () => Promise<void>;
    clearPersonalLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider = ({ children }: { children: ReactNode }) => {
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<SelectedLocationData | null>(null);
    const [address, setAddress] = useState<string>('Localizando...');
    const [locationSourceType, setLocationSourceType] = useState<LocationSourceType>('current_gps');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Listen to Supabase auth state to dynamically namespace data and clear on logout
    useEffect(() => {
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            const newUid = session?.user?.id ?? null;
            setCurrentUserId(newUid);

            if (event === 'SIGNED_OUT' || !newUid) {
                // Clear user private addresses on logout
                setSavedAddresses([]);
                setSelectedLocation(null);
                setAddress('Localização Atual');
                setLocationSourceType('current_gps');
                await removeItem(STORAGE_KEYS.SELECTED_LOCATION);
            } else if (event === 'SIGNED_IN' && newUid) {
                fetchSavedAddresses();
                // Hydrate user-specific location
                const userLoc = await getItem<SelectedLocationData>(STORAGE_KEYS.getUserLocationKey(newUid));
                if (userLoc) {
                    setSelectedLocation(userLoc);
                    setAddress(userLoc.address);
                    setLocationSourceType(userLoc.sourceType || 'saved_address');
                }
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const fetchSavedAddresses = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setSavedAddresses([]);
                return;
            }

            const { data, error } = await supabase
                .from('saved_addresses')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                setSavedAddresses(data as SavedAddress[]);
            }
        } catch (err) {
            console.warn('[LocationContext] Error fetching saved addresses:', err);
        }
    };

    const saveAddress = async (newAddress: Omit<SavedAddress, 'id'>) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Erro', 'Você precisa estar logado para salvar endereços.');
                return;
            }

            const payload = {
                user_id: user.id,
                name: newAddress.name,
                address: newAddress.address,
                latitude: newAddress.latitude,
                longitude: newAddress.longitude,
                streetnumber: newAddress.streetNumber,
                neighborhood: newAddress.neighborhood,
                city: newAddress.city,
                state: newAddress.state,
                icon: newAddress.icon
            };

            const { data: insertedAddress, error } = await supabase
                .from('saved_addresses')
                .insert([payload])
                .select()
                .single();

            if (error) throw error;

            setSavedAddresses(prev => [insertedAddress, ...prev]);
            Alert.alert('Sucesso', 'Endereço salvo com sucesso!');
        } catch (err) {
            console.warn('[LocationContext] Error saving address:', err);
            Alert.alert('Erro', 'Não foi possível salvar o endereço.');
        }
    };

    const deleteAddress = async (id: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('saved_addresses')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) throw error;

            setSavedAddresses(prev => prev.filter(addr => addr.id !== id));
        } catch (err) {
            console.warn('[LocationContext] Error deleting address:', err);
            Alert.alert('Erro', 'Não foi possível remover o endereço.');
        }
    };

    const selectLocation = (
        latitude: number,
        longitude: number,
        addr?: string,
        components?: Partial<SelectedLocationData>
    ) => {
        const sourceType = components?.sourceType || (components?.name ? 'saved_address' : 'custom_selection');
        const newLoc: SelectedLocationData = {
            latitude,
            longitude,
            address: addr || 'Local selecionado',
            sourceType,
            isApproximate: false,
            ...components
        };

        setSelectedLocation(newLoc);
        setLocationSourceType(sourceType);

        if (currentUserId) {
            saveItem(STORAGE_KEYS.getUserLocationKey(currentUserId), newLoc);
        } else {
            saveItem(STORAGE_KEYS.ANON_LOCATION, newLoc);
        }

        if (addr) setAddress(addr);
        else reverseGeocode(latitude, longitude, !!currentUserId);
    };

    const reverseGeocode = async (latitude: number, longitude: number, isAuthenticated: boolean) => {
        try {
            const reverseGeocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (reverseGeocoded.length > 0) {
                const place = reverseGeocoded[0];
                const district = place.district || place.subregion || '';
                const city = place.city || '';
                const state = place.region || '';

                if (!isAuthenticated) {
                    // PRE-LOGIN / ANONYMOUS: Only display generic neighborhood and city, NEVER exact residential street/number
                    const approxAddress = district
                        ? `${district}, ${city || state}`
                        : (city ? `${city} - ${state}` : 'Localização Atual');

                    setAddress(approxAddress);
                    setLocationSourceType('current_gps');

                    const anonLoc: SelectedLocationData = {
                        latitude,
                        longitude,
                        address: approxAddress,
                        neighborhood: district,
                        city: city,
                        state: state,
                        sourceType: 'current_gps',
                        isApproximate: true
                    };
                    setSelectedLocation(anonLoc);
                    saveItem(STORAGE_KEYS.ANON_LOCATION, anonLoc);
                } else {
                    // AUTHENTICATED: Display full formatted address
                    const street = place.street || place.name || '';
                    const number = place.streetNumber || '';

                    let formattedAddress = `${street}${number ? `, ${number}` : ''}`;
                    if (district && district !== street) formattedAddress += ` - ${district}`;
                    if (city && !formattedAddress.includes(city)) formattedAddress += `, ${city}`;

                    setAddress(formattedAddress);
                    setLocationSourceType('current_gps');

                    const authLoc: SelectedLocationData = {
                        latitude,
                        longitude,
                        address: formattedAddress,
                        streetNumber: number,
                        neighborhood: district,
                        city: city,
                        state: state,
                        sourceType: 'current_gps',
                        isApproximate: false
                    };
                    setSelectedLocation(authLoc);
                    if (currentUserId) {
                        saveItem(STORAGE_KEYS.getUserLocationKey(currentUserId), authLoc);
                    }
                }
            } else {
                setAddress('Localização Atual');
            }
        } catch (geoError) {
            console.warn('[LocationContext] Reverse geocoding failed', geoError);
            setAddress('Localização Atual');
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
            console.warn('[LocationContext] Geocoding failed', error);
            return [];
        }
    };

    const refreshLocation = async (updateServiceAddress: boolean = false): Promise<Location.LocationObject | null> => {
        setIsLoading(true);
        setErrorMsg(null);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setErrorMsg('Permissão de localização negada');
                setAddress('Definir localização');
                setIsLoading(false);
                return null;
            }

            const freshLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            setLocation(freshLocation);

            if (updateServiceAddress) {
                const { data: { user } } = await supabase.auth.getUser();
                await reverseGeocode(freshLocation.coords.latitude, freshLocation.coords.longitude, !!user);
            }

            return freshLocation;
        } catch (error) {
            setErrorMsg('Erro ao obter localização');
            if (updateServiceAddress) setAddress('Definir localização');
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const clearPersonalLocation = async () => {
        setSelectedLocation(null);
        setSavedAddresses([]);
        setAddress('Localização Atual');
        setLocationSourceType('current_gps');
        if (currentUserId) {
            await removeItem(STORAGE_KEYS.getUserLocationKey(currentUserId));
        }
        await removeItem(STORAGE_KEYS.SELECTED_LOCATION);
    };

    useEffect(() => {
        const hydrate = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            const uid = user?.id ?? null;
            setCurrentUserId(uid);

            if (uid) {
                const savedLoc = await getItem<SelectedLocationData>(STORAGE_KEYS.getUserLocationKey(uid));
                if (savedLoc) {
                    setSelectedLocation(savedLoc);
                    setAddress(savedLoc.address);
                    setLocationSourceType(savedLoc.sourceType || 'saved_address');
                }
                fetchSavedAddresses();
                refreshLocation(!savedLoc);
            } else {
                // Anonymous: only load generic approximate location or refresh live GPS
                const anonLoc = await getItem<SelectedLocationData>(STORAGE_KEYS.ANON_LOCATION);
                if (anonLoc) {
                    setSelectedLocation(anonLoc);
                    setAddress(anonLoc.address);
                    setLocationSourceType('current_gps');
                }
                refreshLocation(!anonLoc);
            }
        };

        hydrate();
    }, []);

    return (
        <LocationContext.Provider value={{
            location,
            selectedLocation,
            address,
            locationSourceType,
            errorMsg,
            isLoading,
            refreshLocation,
            selectLocation,
            searchAddress,
            savedAddresses,
            saveAddress,
            deleteAddress,
            fetchSavedAddresses,
            clearPersonalLocation
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
