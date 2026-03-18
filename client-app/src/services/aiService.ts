import { supabase } from './supabase';

export interface DiagnosticQuestion {
    id: string;
    text: string;
    type: 'boolean' | 'select' | 'tri'; // tri = sim/não/não sei
    options?: { label: string; value: string }[];
}

// Simple in-memory cache to prevent redundant API calls
const questionCache = new Map<string, { questions: DiagnosticQuestion[], confidence: number }>();
const analysisCache = new Map<string, any>();

export const aiService = {
    /**
     * Call 'generate-diagnostic-questions' Edge Function
     */
    async generateQuestions(category: string, answers: Record<string, string>, userText?: string, min_confidence: number = 0.9) {
        // Create a unique cache key based on inputs
        const cacheKey = JSON.stringify({ category, answers, userText });

        if (questionCache.has(cacheKey)) {
            console.log("⚡ [AI Cache Hit]: Returning cached questions");
            return questionCache.get(cacheKey)!;
        }

        try {
            const { data, error } = await supabase.functions.invoke('generate-diagnostic-questions', {
                body: { category, answers, userText, min_confidence }
            });

            if (error) throw error;
            console.log("🤖 [AI Response - Questions]:", JSON.stringify(data, null, 2));

            const result = data as { questions: DiagnosticQuestion[], confidence: number };

            // Save to cache
            questionCache.set(cacheKey, result);

            return result;
        } catch (err) {
            console.error("AI Gen Error:", err);
            return { questions: [], confidence: 0 };
        }
    },

    /**
     * Call 'analyze-request' Edge Function
     */
    async analyzeRequest(payload: {
        requestId?: string,
        category: string,
        answers: Record<string, string>,
        userText?: string,
        lat?: number,
        lng?: number
    }) {
        // Create cache key ignoring requestId since it might change or vary but inputs match
        const cacheKey = JSON.stringify({
            category: payload.category,
            answers: payload.answers,
            userText: payload.userText
        });

        if (analysisCache.has(cacheKey)) {
            console.log("⚡ [AI Cache Hit]: Returning cached analysis");
            return analysisCache.get(cacheKey);
        }

        try {
            const { data, error } = await supabase.functions.invoke('analyze-request', {
                body: payload
            });

            if (error) throw error;
            console.log("🤖 [AI Response - Analysis]:", JSON.stringify(data, null, 2));

            // Cache the result
            analysisCache.set(cacheKey, data);

            return data;
        } catch (err) {
            console.error("AI Analyze Error:", err);
            return null;
        }
    }
};
