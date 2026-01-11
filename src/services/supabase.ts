import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

type StorageAdapter = {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
};

// SecureStore is a native module; fall back safely if the dev build isn't rebuilt yet.
const SecureStore: { getItemAsync: (key: string) => Promise<string | null>; setItemAsync: (key: string, value: string) => Promise<void>; deleteItemAsync: (key: string) => Promise<void>; } | null = (() => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require('expo-secure-store');
    } catch {
        return null;
    }
})();

const memoryStore = new Map<string, string>();
const ExpoSecureStoreAdapter: StorageAdapter = SecureStore ? {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key),
} : {
    getItem: async (key: string) => memoryStore.get(key) ?? null,
    setItem: async (key: string, value: string) => { memoryStore.set(key, value); },
    removeItem: async (key: string) => { memoryStore.delete(key); },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
