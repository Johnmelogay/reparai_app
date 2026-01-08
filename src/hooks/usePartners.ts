import { useLocation } from '@/context/LocationContext';
import { supabase } from '@/services/supabase';
import { Provider } from '@/types';
import { getItem, saveItem } from '@/utils/storage';
import { useEffect, useState } from 'react';

const STORES_CACHE_KEY = 'cached_stores';

export const usePartners = (radiusMeters: number = 20000) => {
    const { location } = useLocation();
    const [stores, setStores] = useState<Provider[]>([]);
    const [mobile, setMobile] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch ALL stores (Oficinas) - no location dependency
    const fetchStores = async () => {
        try {
            // Check cache first
            const cached = await getItem<Provider[]>(STORES_CACHE_KEY);
            if (cached && cached.length > 0) {
                console.log('🏪 Loaded', cached.length, 'stores from cache');
                setStores(cached);
                setLoading(false); // Show content immediately from cache
            }

            // Fetch all stores using RPC to get coordinates
            const { data, error } = await supabase.rpc('get_all_stores');

            if (data) {
                const fetchedStores: Provider[] = data.map((p: any) => ({
                    id: p.id,
                    name: p.full_name || 'Oficina',
                    image: p.avatar_url,
                    rating: p.rating || 4.5,
                    reviews: 100,
                    category: p.service_category,
                    categories: [p.service_category],
                    hourlyRate: p.base_fee,
                    distance: 'N/A',
                    coordinates: {
                        latitude: p.lat,
                        longitude: p.long,
                    },
                    status: p.is_online ? 'online' : 'offline',
                    badges: [],
                    address: 'Oficina',
                    pricePerDistance: p.price_per_distance,
                    operationalScore: p.operational_score || 100
                }));

                // Update state and cache
                setStores(fetchedStores);
                await saveItem(STORES_CACHE_KEY, fetchedStores);
                console.log('🏪 Fetched and cached', fetchedStores.length, 'stores');
            }
        } catch (e) {
            console.error('Exception fetching stores:', e);
        } finally {
            setLoading(false);
        }
    };

    // Fetch mobile providers near user location
    const fetchMobileProviders = async () => {
        if (!location) return;

        try {
            const { data, error } = await supabase
                .rpc('get_nearby_partners', {
                    input_lat: location.coords.latitude,
                    input_long: location.coords.longitude,
                    radius_meters: radiusMeters
                });

            if (data) {
                const fetchedMobile: Provider[] = data
                    .filter((p: any) => p.type !== 'FIXED') // Use new DB column
                    .map((p: any) => ({
                        id: p.id,
                        name: p.full_name,
                        image: p.avatar_url,
                        rating: p.rating,
                        reviews: 100,
                        category: p.service_category,
                        categories: [p.service_category],
                        hourlyRate: p.base_fee,
                        distance: (p.dist_meters / 1000).toFixed(1) + ' km',
                        coordinates: {
                            latitude: p.lat,
                            longitude: p.long,
                        },
                        status: p.is_online ? 'online' : 'offline',
                        badges: [],
                        address: 'Prestador autônomo',
                        pricePerDistance: p.price_per_distance,
                        operationalScore: 100
                    }));

                setMobile(fetchedMobile);
                console.log('🚶 Fetched', fetchedMobile.length, 'mobile providers');
            }
        } catch (e) {
            console.error('Exception fetching mobile providers:', e);
        }
    };

    // Initial load: Fetch stores immediately (no location needed)
    useEffect(() => {
        fetchStores();
    }, []);

    // Poll mobile providers every 5 minutes (requires location)
    useEffect(() => {
        if (!location) return;

        fetchMobileProviders();

        const interval = setInterval(() => {
            console.log('🔄 Polling mobile providers...');
            fetchMobileProviders();
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [location]);

    const refetch = async () => {
        setLoading(true);
        await fetchStores();
        if (location) await fetchMobileProviders();
        setLoading(false);
    };

    return {
        providers: [...stores, ...mobile],
        loading,
        refetch
    };
};
