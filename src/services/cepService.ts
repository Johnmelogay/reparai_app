/**
 * CEP Service
 * Integrates with ViaCEP API for Brazilian postal code lookup
 */

export interface CEPData {
    cep: string;
    logradouro: string; // Street name
    complemento: string;
    bairro: string; // Neighborhood
    localidade: string; // City
    uf: string; // State
    erro?: boolean;
}

/**
 * Fetch address data from CEP
 */
export async function fetchAddressFromCEP(cep: string): Promise<CEPData | null> {
    // Remove non-numeric characters
    const cleanCep = cep.replace(/\D/g, '');

    if (cleanCep.length !== 8) {
        return null;
    }

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();

        if (data.erro) {
            return null;
        }

        return data as CEPData;
    } catch (error) {
        console.error('CEP lookup error:', error);
        return null;
    }
}

/**
 * Format CEP for display (XXXXX-XXX)
 */
export function formatCEP(cep: string): string {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return cep;
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
}

/**
 * Mock saved addresses (prepare for Supabase integration)
 */
export interface SavedAddress {
    id: string;
    label: string; // e.g., "Casa", "Trabalho"
    cep: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    reference?: string;
    isDefault: boolean;
}

/**
 * Get user's saved addresses (MOCK - will integrate with Supabase Auth)
 */
export async function getSavedAddresses(userId?: string): Promise<SavedAddress[]> {
    // TODO: Implement Supabase query
    // const { data } = await supabase
    //     .from('user_addresses')
    //     .select('*')
    //     .eq('user_id', userId)
    //     .order('is_default', { ascending: false });

    // MOCK DATA for now
    return [
        {
            id: '1',
            label: '🏠 Casa',
            cep: '76801-001',
            street: 'Av. Carlos Gomes',
            number: '1234',
            complement: 'Apto 101',
            neighborhood: 'Centro',
            city: 'Porto Velho',
            state: 'RO',
            reference: 'Próximo ao shopping',
            isDefault: true
        },
        {
            id: '2',
            label: '💼 Trabalho',
            cep: '76801-900',
            street: 'Rua Abunã',
            number: '567',
            neighborhood: 'Olaria',
            city: 'Porto Velho',
            state: 'RO',
            isDefault: false
        }
    ];
}

/**
 * Save new address (MOCK - will integrate with Supabase)
 */
export async function saveAddress(address: Omit<SavedAddress, 'id'>, userId?: string): Promise<boolean> {
    // TODO: Implement Supabase insert
    // const { error } = await supabase
    //     .from('user_addresses')
    //     .insert({ ...address, user_id: userId });
    // return !error;

    console.log('Saving address (mock):', address);
    return true;
}
