/**
 * File: src/hooks/usePartners.ts
 * Purpose: Custom hook to fetch and manage Service Providers data.
 *
 * Data flow:
 *   1. Load cached providers from AsyncStorage (instant render)
 *   2. Fetch fresh data via `get_map_partners_v2` RPC
 *   3. Subscribe to realtime `is_online` status changes
 *   4. Recalculate distances client-side when location changes
 *
 * Error handling:
 *   - Exposes `error` string so UI can show NetworkErrorBanner
 *   - Logs all failures through the centralized logger
 *   - Never silently swallows errors or returns fake data
 */
import { useAuth } from '@/context/AuthContext';
import { useLocation } from '@/context/LocationContext';
import { supabase } from '@/services/supabase';
import { Provider } from '@/types';
import { calculateDistance } from '@/utils/geo';
import { logger } from '@/utils/logger';
import { getItem, saveItem } from '@/utils/storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

const PARTNERS_CACHE_KEY = 'cached_partners_v4';

const inFlightRequests = new Map<string, Promise<Provider[]>>();

// Helper function extracted so it can be used by React Query
const fetchPartnersFromRPC = async (
    centerLat: number,
    centerLng: number,
    radiusKm: number
): Promise<Provider[]> => {
    const requestKey = `${centerLat}_${centerLng}_${radiusKm}`;
    if (inFlightRequests.has(requestKey)) {
        return inFlightRequests.get(requestKey)!;
    }

    const fetchPromise = (async () => {
        try {
            logger.info('Fetching fresh partners via RPC...', { centerLat, centerLng, radiusKm });
            const { data, error: rpcError } = await supabase.rpc('get_map_partners_v2', {
                input_lat: centerLat,
                input_long: centerLng,
                radius_km: radiusKm,
                max_limit: 250
            });

            if (rpcError) {
                logger.error('RPC get_map_partners_v2 failed', {
                    code: rpcError.code,
                    message: rpcError.message,
                    details: rpcError.details,
                });
                throw new Error('Não foi possível carregar prestadores.');
            }

            if (!data) return [];

            const mappedProviders: Provider[] = data.map((p: any) => {
                const isOficina = p.type === 'FIXED';
                return {
                    id: p.id,
                    name: p.full_name || 'Prestador',
                    image: p.avatar_url || 'https://via.placeholder.com/150',
                    rating: p.rating || 5.0,
                    reviews: 0,
                    category: p.service_category || 'Geral',
                    categories: [p.service_category],
                    hourlyRate: p.hourly_rate || 100,
                    distance: p.dist_km ? `${p.dist_km.toFixed(1)}km` : '...',
                    coordinates: {
                        latitude: Number(p.lat),
                        longitude: Number(p.long),
                    },
                    status: p.is_online ? 'online' : 'offline',
                    badges: [],
                    type: p.type,
                    address: isOficina ? 'Oficina' : 'Prestador autônomo',
                    visitPrice: '50,00',
                    operationalScore: 100
                };
            }).filter((p: Provider) =>
                Number.isFinite(p.coordinates.latitude) && Number.isFinite(p.coordinates.longitude)
            );

            // Save to local storage for instant offline fallback
            await saveItem(PARTNERS_CACHE_KEY, mappedProviders);
            return mappedProviders;
        } finally {
            inFlightRequests.delete(requestKey);
        }
    })();

    inFlightRequests.set(requestKey, fetchPromise);
    return fetchPromise;
};

export const usePartners = (radiusMeters: number = 50000) => {
    const { user } = useAuth();
    const { location, selectedLocation } = useLocation();
    const queryClient = useQueryClient();

    // Round center to avoid excessive cache key churn on tiny GPS changes.
    const centerLat = selectedLocation?.latitude || location?.coords.latitude || -8.76183;
    const centerLng = selectedLocation?.longitude || location?.coords.longitude || -63.90177;
    const roundedLat = Number(centerLat.toFixed(4));
    const roundedLng = Number(centerLng.toFixed(4));
    const radiusKm = Math.max(1, Math.round(radiusMeters / 1000));
    const queryKey = useMemo(
        () => ['partners', 'map', roundedLat, roundedLng, radiusKm] as const,
        [roundedLat, roundedLng, radiusKm]
    );

    const {
        data: providers = [],
        isLoading,
        isError,
        error,
        refetch
    } = useQuery({
        queryKey,
        enabled: !!user,
        queryFn: async () => {
            try {
                const cached = await getItem<Provider[]>(PARTNERS_CACHE_KEY);
                if (cached?.length && !queryClient.getQueryData(queryKey)) {
                    queryClient.setQueryData(queryKey, cached);
                }
            } catch { }

            return fetchPartnersFromRPC(roundedLat, roundedLng, radiusKm);
        },
        staleTime: 5 * 60 * 1000, // Data stays fresh for 5 mins
        gcTime: 30 * 60 * 1000,
        retry: 1, // Only retry once on failure with backoff
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
        refetchInterval: (query) => (query.state.error ? false : 30 * 1000), // Pause polling on error
    });

    // Realtime: partner online/offline/location changes trigger debounced invalidation
    useEffect(() => {
        let invalidateTimer: ReturnType<typeof setTimeout> | null = null;
        const scheduleInvalidate = () => {
            if (invalidateTimer) return;
            invalidateTimer = setTimeout(() => {
                invalidateTimer = null;
                queryClient.invalidateQueries({
                    predicate: ({ queryKey: key }) =>
                        Array.isArray(key) && key[0] === 'partners' && key[1] === 'map',
                });
            }, 1000);
        };

        const channel = supabase.channel('partners_status_updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'partners' },
                () => scheduleInvalidate()
            )
            .subscribe();

        return () => {
            if (invalidateTimer) clearTimeout(invalidateTimer);
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    // Recalcula as distâncias baseado na localização atual sem precisar refetch na API
    const providersWithDistance = useMemo(() => {
        const center = selectedLocation ?
            { latitude: selectedLocation.latitude, longitude: selectedLocation.longitude } :
            (location ? location.coords : null);

        if (!center || !providers.length) return providers;

        return providers.map(p => {
            const distKm = calculateDistance(center, p.coordinates);
            return {
                ...p,
                distance: distKm < 1 ? `${(distKm * 1000).toFixed(0)}m` : `${distKm.toFixed(1)}km`,
                rawDistance: distKm
            };
        });
    }, [providers, location, selectedLocation]);

    return {
        providers: providersWithDistance,
        loading: isLoading,
        error: isError ? (error instanceof Error ? error.message : 'Erro ao carregar parceiros') : null,
        refetch
    };
};
