import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persistência Local (Storage)
 * 
 * Este arquivo fornece funções para salvar e carregar dados no celular do usuário.
 */

// Chaves base usadas para salvar os dados
export const STORAGE_KEYS = {
    ANON_LOCATION: '@reparai:anon_location',
    SELECTED_LOCATION: '@reparai:selected_location',
    ACTIVE_DRAFT: '@reparai:active_draft',
    RECENT_ADDRESSES: '@reparai:recent_addresses',
    getUserLocationKey: (userId: string) => `@reparai:selected_location:${userId}`,
    getUserDraftKey: (userId: string) => `@reparai:active_draft:${userId}`,
    getUserRecentAddressesKey: (userId: string) => `@reparai:recent_addresses:${userId}`,
};

/**
 * Salva um item no armazenamento local
 */
export const saveItem = async (key: string, value: any) => {
    try {
        const jsonValue = JSON.stringify(value);
        await AsyncStorage.setItem(key, jsonValue);
    } catch (e) {
        console.warn(`[Storage] Error saving item ${key}:`, e);
    }
};

/**
 * Carrega um item do armazenamento local
 */
export const getItem = async <T>(key: string): Promise<T | null> => {
    try {
        const jsonValue = await AsyncStorage.getItem(key);
        return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
        console.warn(`[Storage] Error getting item ${key}:`, e);
        return null;
    }
};

/**
 * Remove um item do armazenamento local
 */
export const removeItem = async (key: string) => {
    try {
        await AsyncStorage.removeItem(key);
    } catch (e) {
        console.warn(`[Storage] Error removing item ${key}:`, e);
    }
};

/**
 * Limpa todos os dados pessoais do usuário na saída (logout)
 */
export const clearUserStorage = async (userId?: string | null) => {
    try {
        const keysToRemove = [
            STORAGE_KEYS.SELECTED_LOCATION,
            STORAGE_KEYS.ACTIVE_DRAFT,
            STORAGE_KEYS.RECENT_ADDRESSES,
            STORAGE_KEYS.ANON_LOCATION,
        ];

        if (userId) {
            keysToRemove.push(
                STORAGE_KEYS.getUserLocationKey(userId),
                STORAGE_KEYS.getUserDraftKey(userId),
                STORAGE_KEYS.getUserRecentAddressesKey(userId)
            );
        }

        // Also scan and remove any lingering namespaced keys
        const allKeys = await AsyncStorage.getAllKeys();
        const userKeys = allKeys.filter(k => k.startsWith('@reparai:selected_location:') || k.startsWith('@reparai:active_draft:') || k.startsWith('@reparai:recent_addresses:'));
        keysToRemove.push(...userKeys);

        await AsyncStorage.multiRemove(Array.from(new Set(keysToRemove)));
    } catch (e) {
        console.warn('[Storage] Error clearing user storage:', e);
    }
};

/**
 * Limpa todo o armazenamento do app
 */
export const clearStorage = async () => {
    try {
        await AsyncStorage.clear();
    } catch (e) {
        console.warn('[Storage] Error clearing all storage:', e);
    }
};
