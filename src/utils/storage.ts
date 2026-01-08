import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persistência Local (Storage)
 * 
 * Este arquivo fornece funções para salvar e carregar dados no celular do usuário.
 * É como o "localStorage" do navegador, mas para React Native.
 */

// Chaves usadas para salvar os dados
export const STORAGE_KEYS = {
    SELECTED_LOCATION: '@reparai:selected_location',
    ACTIVE_DRAFT: '@reparai:active_draft',
    RECENT_ADDRESSES: '@reparai:recent_addresses',
};

/**
 * Salva um item no armazenamento local
 * @param key Chave (use STORAGE_KEYS)
 * @param value Valor (objeto ou string)
 */
export const saveItem = async (key: string, value: any) => {
    try {
        const jsonValue = JSON.stringify(value);
        await AsyncStorage.setItem(key, jsonValue);
    } catch (e) {
        console.error(`Error saving item ${key}:`, e);
    }
};

/**
 * Carrega um item do armazenamento local
 * @param key Chave (use STORAGE_KEYS)
 * @returns O valor salvo ou null
 */
export const getItem = async <T>(key: string): Promise<T | null> => {
    try {
        const jsonValue = await AsyncStorage.getItem(key);
        return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
        console.error(`Error getting item ${key}:`, e);
        return null;
    }
};

/**
 * Remove um item do armazenamento local
 * @param key Chave
 */
export const removeItem = async (key: string) => {
    try {
        await AsyncStorage.removeItem(key);
    } catch (e) {
        console.error(`Error removing item ${key}:`, e);
    }
};

/**
 * Limpa todos os dados salvos pelo app
 */
export const clearStorage = async () => {
    try {
        await AsyncStorage.clear();
    } catch (e) {
        console.error('Error clearing storage:', e);
    }
};
