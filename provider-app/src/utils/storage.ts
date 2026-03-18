import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
    PROVIDER_STATUS: '@reparai_provider:status',
    ACTIVE_ORDER: '@reparai_provider:active_order',
    ONBOARDING_COMPLETE: '@reparai_provider:onboarding_complete',
};

export const saveItem = async (key: string, value: any) => {
    try {
        const jsonValue = JSON.stringify(value);
        await AsyncStorage.setItem(key, jsonValue);
    } catch (e) {
        console.error(`Error saving item ${key}:`, e);
    }
};

export const getItem = async <T>(key: string): Promise<T | null> => {
    try {
        const jsonValue = await AsyncStorage.getItem(key);
        return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
        console.error(`Error getting item ${key}:`, e);
        return null;
    }
};

export const removeItem = async (key: string) => {
    try {
        await AsyncStorage.removeItem(key);
    } catch (e) {
        console.error(`Error removing item ${key}:`, e);
    }
};
