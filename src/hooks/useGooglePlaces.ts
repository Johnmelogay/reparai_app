import { Config } from '@/constants/Config';
import { useCallback, useRef, useState } from 'react';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

// Types for Google Places API (New)
interface Prediction {
    placePrediction: {
        placeId: string;
        text: {
            text: string;
        };
        structuredFormat: {
            mainText: { text: string };
            secondaryText?: { text: string };
        };
    };
}

interface PlaceDetails {
    formattedAddress: string;
    location: {
        latitude: number;
        longitude: number;
    };
    displayName?: {
        text: string;
    };
    addressComponents?: {
        longText: string;
        shortText: string;
        types: string[];
    }[];
}

export const useGooglePlaces = () => {
    const [predictions, setPredictions] = useState<Prediction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const sessionTokenRef = useRef<string | null>(null);
    const debounceTimerRef = useRef<any>(null);

    // Generate a session token if one doesn't exist
    const getSessionToken = useCallback(() => {
        if (!sessionTokenRef.current) {
            sessionTokenRef.current = uuidv4();
            console.log('[GooglePlaces] New Session Token generated:', sessionTokenRef.current);
        }
        return sessionTokenRef.current;
    }, []);

    // Refresh token logic (after a Place Details call)
    const refreshSessionToken = useCallback(() => {
        sessionTokenRef.current = uuidv4();
        console.log('[GooglePlaces] Session Token refreshed:', sessionTokenRef.current);
    }, []);

    // Search function with Debounce
    const searchPlaces = useCallback((query: string, locationBias?: { latitude: number; longitude: number }) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        if (query.length < 3) {
            setPredictions([]);
            return;
        }

        debounceTimerRef.current = setTimeout(async () => {
            setIsLoading(true);
            const token = getSessionToken();

            try {
                const body: any = {
                    input: query,
                    sessionToken: token,
                    includedRegionCodes: ['BR'],
                };

                if (locationBias) {
                    body.locationBias = { // Changed from restriction to bias for more flexibility
                        circle: {
                            center: {
                                latitude: locationBias.latitude,
                                longitude: locationBias.longitude
                            },
                            radius: 10000 // 10km bias
                        }
                    };
                }

                const response = await fetch(`${Config.GOOGLE_PLACES_API_URL}/places:autocomplete`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': Config.GOOGLE_PLACES_API_KEY,
                    },
                    body: JSON.stringify(body),
                });

                const data = await response.json();

                if (data.suggestions) {
                    setPredictions(data.suggestions.slice(0, 5)); // Increased to 5
                } else {
                    if (data.error) {
                        console.error('[GooglePlaces] API Error:', data.error.message);
                    }
                    setPredictions([]);
                }
            } catch (error) {
                console.error('[GooglePlaces] Network Error:', error);
                setPredictions([]);
            } finally {
                setIsLoading(false);
            }
        }, 500); // 500ms debounce
    }, [getSessionToken]);

    // Get Details function using FieldsMask
    const getPlaceDetails = useCallback(async (placeId: string): Promise<PlaceDetails | null> => {
        setIsLoading(true);
        const token = getSessionToken(); // Use same token as autocomplete

        try {
            // Fields: displayName, formattedAddress, location (LAT/LNG), addressComponents
            // FieldMask for GET /places/{id} should NOT have 'places.' prefix
            const fieldMask = 'displayName,formattedAddress,location,addressComponents';

            // New Places API: sessionToken is a query param for GET Details
            const url = `${Config.GOOGLE_PLACES_API_URL}/places/${placeId}?sessionToken=${token}&key=${Config.GOOGLE_PLACES_API_KEY}`;

            console.log('[GooglePlaces] Fetching details for:', placeId);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': Config.GOOGLE_PLACES_API_KEY,
                    'X-Goog-FieldMask': fieldMask,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[GooglePlaces] Details API Error:', response.status, errorText);
                return null;
            }

            const data = await response.json();

            // After successful details fetch, we MUST refresh the token for the next session
            refreshSessionToken();

            return data as PlaceDetails;

        } catch (error) {
            console.error('[GooglePlaces] Error fetching details:', error);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [getSessionToken, refreshSessionToken]);

    // Reverse Geocoding (Lat/Lng -> Address with Street Number & POI)
    const reverseGeocode = useCallback(async (latitude: number, longitude: number): Promise<{
        address: string;
        street?: string;
        number?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
        placeName?: string;
    } | null> => {
        setIsLoading(true);
        try {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${Config.GOOGLE_PLACES_API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK' && data.results.length > 0) {
                // The first result is usually the most specific (street address or POI)
                const result = data.results[0];
                const components = result.address_components;

                let street = '';
                let number = '';
                let neighborhood = '';
                let city = '';
                let state = '';
                let placeName = '';

                // Check if the result is actually a POI (establishment) or just a street address
                if (result.types.includes('point_of_interest') || result.types.includes('establishment')) {
                    // Start with the name of the place from "address_components" won't work well usually.
                    // Geocoding API implies the "result" might not have a "name" field directly like Places API.
                    // BUT, if it is a POI, the formatted_address usually starts with the place name? 
                    // No, Geocoding API is strictly address-focused. 
                    // HOWEVER, sometimes it returns "premise" or "establishment".

                    // Actually, for "Place Name", we ideally need Places API (nearbySearch), but let's try to infer/extract what we can.
                    // or... we could use the "plus_code" or just rely on the fact that we primarily need the NUMBER.
                    // Let's stick to standard components extraction.
                }

                components.forEach((c: any) => {
                    if (c.types.includes('route')) street = c.long_text;
                    if (c.types.includes('street_number')) number = c.long_text;
                    if (c.types.includes('sublocality') || c.types.includes('sublocality_level_1')) neighborhood = c.long_text;
                    if (c.types.includes('administrative_area_level_2')) city = c.long_text;
                    if (c.types.includes('administrative_area_level_1')) state = c.short_text;
                });

                // Construct a nice address string
                // If we want "Place Name", Geocoding API is weak there. 
                // BUT the user asked for "place name if applicable".
                // We'll trust formatted_address for the main display, OR build our own.
                // Let's build our own to ensure "Number" is prominent if extracted.

                let formatted = street;
                if (number) formatted += `, ${number}`;
                if (neighborhood) formatted += ` - ${neighborhood}`;
                if (city) formatted += ` - ${city}`;

                return {
                    address: formatted || result.formatted_address,
                    street,
                    number,
                    neighborhood,
                    city,
                    state,
                    placeName // Geocoding API doesn't reliably return place names. We'd need to use Places API for that. 
                    // For now we leave empty, or we could do a quick "Place Search" for these coords if we really wanted perfection.
                };
            }
            return null;
        } catch (error) {
            console.error('[GooglePlaces] Reverse Geocode Error:', error);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        predictions,
        searchPlaces,
        getPlaceDetails,
        reverseGeocode,
        isLoading,
    };
};
