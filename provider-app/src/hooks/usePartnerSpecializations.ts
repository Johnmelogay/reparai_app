import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import { PartnerSpecialization } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type SpecializationInput = {
    domain_slug: string | null;
    asset_slug: string | null;
    service_type_slug: string | null;
};

export function usePartnerSpecializations() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const queryKey = ['partner_specializations', user?.id];

    const {
        data: specializations = [],
        isLoading,
        refetch,
    } = useQuery({
        queryKey,
        enabled: !!user,
        queryFn: async (): Promise<PartnerSpecialization[]> => {
            if (!user) return [];

            const { data, error } = await supabase
                .from('partner_specializations')
                .select('id, partner_id, domain_slug, asset_slug, service_type_slug, created_at')
                .eq('partner_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []) as PartnerSpecialization[];
        },
        staleTime: 5 * 60 * 1000,
    });

    const saveMutation = useMutation({
        mutationFn: async (next: SpecializationInput[]) => {
            const { error } = await supabase.rpc('upsert_my_partner_specializations', {
                input_specs: next,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
        },
    });

    const saveSpecializations = async (next: SpecializationInput[]) => {
        try {
            await saveMutation.mutateAsync(next);
            return { error: null };
        } catch (error) {
            return { error };
        }
    };

    return {
        specializations,
        loading: isLoading,
        refetch,
        saveSpecializations,
    };
}
