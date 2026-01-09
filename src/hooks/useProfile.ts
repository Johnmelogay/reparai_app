import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import { useEffect, useState } from 'react';

export interface UserProfile {
    id: string;
    full_name: string;
    avatar_url: string;
    phone: string;
    user_type?: 'client' | 'provider' | 'admin';
}

export const useProfile = () => {
    const { user, session } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async () => {
        if (!user) return;
        setLoading(true);

        try {
            // 1. Try fetching from 'clients' table
            const { data: clientData, error: clientError } = await supabase
                .from('clients')
                .select('*')
                .eq('id', user.id)
                .single();

            if (clientData) {
                setProfile({ ...clientData, user_type: 'client' });
                setLoading(false);
                return;
            }

            // 2. If not found, try 'profiles' (Providers/Admins)
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileData) {
                setProfile(profileData);
            } else {
                // Fallback to Auth Metadata if DB is missing row (rare edge case)
                setProfile({
                    id: user.id,
                    full_name: user.user_metadata?.full_name || '',
                    avatar_url: user.user_metadata?.avatar_url || '',
                    phone: user.phone || '',
                    user_type: user.user_metadata?.user_type || 'client'
                });
            }

        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateProfile = async (updates: Partial<UserProfile>) => {
        if (!user || !profile) return { error: 'No user loaded' };

        try {
            const table = profile.user_type === 'client' ? 'clients' : 'profiles';

            const { error } = await supabase
                .from(table)
                .update(updates)
                .eq('id', user.id);

            if (error) throw error;

            // Update local state immediately for UI responsiveness
            setProfile(prev => prev ? { ...prev, ...updates } : null);

            return { error: null };
        } catch (error) {
            console.error('Error updating profile:', error);
            return { error };
        }
    };

    useEffect(() => {
        if (session) {
            fetchProfile();
        } else {
            setProfile(null);
            setLoading(false);
        }
    }, [session]);

    return {
        profile,
        loading,
        refetch: fetchProfile,
        updateProfile
    };
};
