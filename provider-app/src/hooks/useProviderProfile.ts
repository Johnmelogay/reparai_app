import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import { ProviderProfile } from '@/types';
import { normalizeCategoryDomain } from '@/utils/category';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useProviderProfile() {
    const { user, session } = useAuth();
    const queryClient = useQueryClient();

    const {
        data: profile = null,
        isLoading: loading,
        refetch,
    } = useQuery({
        queryKey: ['provider_profile', user?.id],
        queryFn: async (): Promise<ProviderProfile | null> => {
            if (!user) return null;

            const { data, error } = await supabase
                .from('partners')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (error) {
                console.warn('[useProviderProfile] Error fetching profile:', error.message);
                return null;
            }

            if (!data) {
                const fallbackName =
                    user.user_metadata?.full_name ||
                    user.email?.split('@')[0] ||
                    'Prestador';

                const { data: created, error: createError } = await supabase
                    .from('partners')
                    .upsert({
                        id: user.id,
                        full_name: fallbackName,
                        user_type: 'provider',
                        is_online: false,
                    }, { onConflict: 'id' })
                    .select('*')
                    .single();

                if (createError) {
                    console.warn('[useProviderProfile] Error creating profile:', createError.message);
                    return null;
                }

                return created as ProviderProfile;
            }

            const normalizedCategory = normalizeCategoryDomain((data as any).service_category);
            if (normalizedCategory && normalizedCategory !== (data as any).service_category) {
                const { error: normalizeError } = await supabase
                    .from('partners')
                    .update({ service_category: normalizedCategory })
                    .eq('id', user.id);

                if (!normalizeError) {
                    (data as any).service_category = normalizedCategory;
                }
            }

            return data as ProviderProfile;
        },
        enabled: !!user && !!session,
        staleTime: 10 * 60 * 1000,
    });

    const updateMutation = useMutation({
        mutationFn: async (updates: Partial<ProviderProfile>) => {
            if (!user) throw new Error('No user loaded');

            const { error } = await supabase
                .from('partners')
                .update(updates)
                .eq('id', user.id);

            if (error) throw error;
            return updates;
        },
        onMutate: async (updates) => {
            await queryClient.cancelQueries({ queryKey: ['provider_profile', user?.id] });
            const previous = queryClient.getQueryData<ProviderProfile>(['provider_profile', user?.id]);

            if (previous) {
                queryClient.setQueryData<ProviderProfile>(['provider_profile', user?.id], {
                    ...previous,
                    ...updates,
                });
            }
            return { previous };
        },
        onError: (_err, _updates, context) => {
            if (context?.previous) {
                queryClient.setQueryData(['provider_profile', user?.id], context.previous);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['provider_profile', user?.id] });
        },
    });

    const updateProfile = async (updates: Partial<ProviderProfile>) => {
        try {
            await updateMutation.mutateAsync(updates);
            return { error: null };
        } catch (error) {
            return { error };
        }
    };

    const toggleOnline = async (isOnline: boolean) => {
        if (!user) return { error: new Error('No user loaded') };

        try {
            const { data, error } = await supabase
                .from('partners')
                .update({ is_online: isOnline })
                .eq('id', user.id)
                .select('id')
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                const fallbackName =
                    user.user_metadata?.full_name ||
                    user.email?.split('@')[0] ||
                    'Prestador';

                const { error: upsertError } = await supabase
                    .from('partners')
                    .upsert(
                        {
                            id: user.id,
                            full_name: fallbackName,
                            user_type: 'provider',
                            is_online: isOnline,
                        },
                        { onConflict: 'id' }
                    );

                if (upsertError) throw upsertError;
            }

            await queryClient.invalidateQueries({ queryKey: ['provider_profile', user.id] });
            return { error: null };
        } catch (error) {
            return { error };
        }
    };

    return {
        profile,
        loading,
        refetch,
        updateProfile,
        toggleOnline,
    };
}
