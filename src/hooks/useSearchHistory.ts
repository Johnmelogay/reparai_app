import { getItem, saveItem } from '@/utils/storage';
import { useEffect, useState } from 'react';

const HISTORY_KEY = 'search_history';
const MAX_HISTORY = 8;

export const useSearchHistory = () => {
    const [history, setHistory] = useState<string[]>([]);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        const stored = await getItem<string[]>(HISTORY_KEY);
        if (stored) setHistory(stored);
    };

    const addToHistory = async (term: string) => {
        if (!term.trim()) return;

        let newHistory = [term.trim(), ...history.filter(h => h.toLowerCase() !== term.trim().toLowerCase())];
        newHistory = newHistory.slice(0, MAX_HISTORY);

        setHistory(newHistory);
        await saveItem(HISTORY_KEY, newHistory);
    };

    const clearHistory = async () => {
        setHistory([]);
        await saveItem(HISTORY_KEY, []);
    };

    const removeFromHistory = async (term: string) => {
        const newHistory = history.filter(h => h !== term);
        setHistory(newHistory);
        await saveItem(HISTORY_KEY, newHistory);
    };

    return {
        history,
        addToHistory,
        clearHistory,
        removeFromHistory
    };
};
