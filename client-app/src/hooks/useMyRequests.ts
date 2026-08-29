/**
 * File: src/hooks/useMyRequests.ts
 * Purpose: Fetches the current user's requests from Supabase,
 * split into "active" and "history" lists. Uses React Query
 * with realtime subscription for live updates.
 */
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export interface MyRequest {
    id: string;
    user_id: string;
    category: string;
    user_text: string | null;
    answers_json: Record<string, string> | null;
    ai_result_json: any | null;
    lat: number | null;
    lng: number | null;
    address: string | null;
    status: string;
    provider_id: string | null;
    displacement_fee: number | null;
    created_at: string;
    updated_at: string;
    expires_at: string | null;
    // Joined provider data (nullable)
    provider_name: string | null;
    provider_avatar: string | null;
    provider_rating: number | null;
}

const ACTIVE_STATUSES = ['finding', 'offered', 'answered', 'accepted', 'confirmed', 'en_route', 'arrived', 'quote_provided', 'quote_accepted'];
const DONE_STATUSES = ['done'];
const CANCELED_STATUSES = ['canceled', 'declined', 'expired', 'disputed'];

async function fetchMyRequests(userId: string): Promise<MyRequest[]> {
    // Fetch requests with a left join on partners for provider info
    const { data, error } = await supabase
        .from('requests')
        .select(`
            id,
            user_id,
            category,
            user_text,
            answers_json,
            ai_result_json,
            lat,
            lng,
            address,
            status,
            provider_id,
            displacement_fee,
            created_at,
            updated_at,
            expires_at,
            partners:provider_id (
                full_name,
                avatar_url,
                rating
            )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;

    // Flatten the joined partner data
    return (data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        category: row.category,
        user_text: row.user_text,
        answers_json: row.answers_json,
        ai_result_json: row.ai_result_json,
        lat: row.lat,
        lng: row.lng,
        address: row.address,
        status: row.status,
        provider_id: row.provider_id,
        displacement_fee: row.displacement_fee,
        created_at: row.created_at,
        updated_at: row.updated_at,
        expires_at: row.expires_at,
        provider_name: row.partners?.full_name || null,
        provider_avatar: row.partners?.avatar_url || null,
        provider_rating: row.partners?.rating || null,
    }));
}

export function useMyRequests() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const queryKey = ['my_requests', user?.id];

    const {
        data: allRequests = [],
        isLoading,
        isError,
        error,
        refetch
    } = useQuery({
        queryKey,
        queryFn: () => fetchMyRequests(user!.id),
        enabled: !!user,
        staleTime: 2 * 60 * 1000, // 2 min fresh
    });

    // Realtime subscription: any change to this user's requests invalidates the query
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`my_requests_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'requests',
                    filter: `user_id=eq.${user.id}`,
                },
                () => {
                    // Invalidate and refetch when any change happens
                    queryClient.invalidateQueries({ queryKey });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, queryClient]);

    const activeRequests = allRequests.filter(r => ACTIVE_STATUSES.includes(r.status));
    const doneRequests = allRequests.filter(r => DONE_STATUSES.includes(r.status));
    const canceledRequests = allRequests.filter(r => CANCELED_STATUSES.includes(r.status));

    return {
        allRequests,
        activeRequests,
        doneRequests,
        canceledRequests,
        loading: isLoading,
        error: isError ? (error instanceof Error ? error.message : 'Erro ao carregar pedidos') : null,
        refetch,
    };
}
