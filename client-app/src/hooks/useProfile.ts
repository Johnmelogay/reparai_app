import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface UserProfile {
    id: string;
    full_name: string;
    avatar_url: string;
    phone: string;
    user_type?: 'client' | 'provider' | 'admin';
}

export const useProfile = () => {
    const { user, session } = useAuth();
    const queryClient = useQueryClient();

    const {
        data: profile = null,
        isLoading: loading,
        refetch
    } = useQuery({
        queryKey: ['profile', user?.id],
        queryFn: async () => {
            if (!user) return null;

            // 1. Try fetching from 'clients' table
            const { data: clientData } = await supabase
                .from('clients')
                .select('*')
                .eq('id', user.id)
                .single();

            if (clientData) {
                return { ...clientData, user_type: 'client' } as UserProfile;
            }

            // 2. If not found, try 'profiles' (Providers/Admins)
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileData) {
                return profileData as UserProfile;
            }

            // Fallback to Auth Metadata if DB is missing row (rare edge case)
            return {
                id: user.id,
                full_name: user.user_metadata?.full_name || '',
                avatar_url: user.user_metadata?.avatar_url || '',
                phone: user.phone || '',
                user_type: user.user_metadata?.user_type || 'client'
            } as UserProfile;
        },
        enabled: !!user && !!session, // Only run query if user is logged in
        staleTime: 10 * 60 * 1000, // Profile data usually shouldn't change often, keep fresh for 10 min
    });

    const updateMutation = useMutation({
        mutationFn: async (updates: Partial<UserProfile>) => {
            if (!user || !profile) throw new Error('No user loaded');

            const table = profile.user_type === 'client' ? 'clients' : 'profiles';

            const { error } = await supabase
                .from(table)
                .update(updates)
                .eq('id', user.id);

            if (error) throw error;
            return updates;
        },
        onMutate: async (updates) => {
            // Cancel any outgoing refetches so they don't overwrite our optimistic update
            await queryClient.cancelQueries({ queryKey: ['profile', user?.id] });
            const previousProfile = queryClient.getQueryData<UserProfile>(['profile', user?.id]);

            // Optimistically update to the new value
            if (previousProfile) {
                queryClient.setQueryData<UserProfile>(['profile', user?.id], {
                    ...previousProfile,
                    ...updates
                });
            }
            return { previousProfile };
        },
        onError: (err, newProfile, context) => {
            // Roll back to previous truth on failure
            if (context?.previousProfile) {
                queryClient.setQueryData(['profile', user?.id], context.previousProfile);
            }
            console.error('Error updating profile:', err);
        },
        onSettled: () => {
            // Always refetch after error or success:
            queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
        },
    });

    const updateProfile = async (updates: Partial<UserProfile>) => {
        try {
            await updateMutation.mutateAsync(updates);
            return { error: null };
        } catch (error) {
            return { error };
        }
    };

    return {
        profile,
        loading,
        refetch,
        updateProfile
    };
};
