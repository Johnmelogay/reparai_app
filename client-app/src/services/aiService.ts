import { logger } from '@/utils/logger';
import { supabase } from './supabase';

export interface DiagnosticQuestion {
    id: string;
    text: string;
    type: 'boolean' | 'select' | 'tri'; // tri = sim/não/não sei
    options?: { label: string; value: string }[];
}

// In-memory caches to prevent redundant API calls
const questionCache = new Map<string, { questions: DiagnosticQuestion[], confidence: number }>();
const analysisCache = new Map<string, any>();

// In-flight single-flight promises to prevent concurrent duplicate invocations
const inFlightQuestions = new Map<string, Promise<{ questions: DiagnosticQuestion[], confidence: number }>>();
const inFlightAnalysis = new Map<string, Promise<any>>();

export const aiService = {
    /**
     * Call 'generate-diagnostic-questions' Edge Function
     */
    async generateQuestions(
        category: string,
        answers: Record<string, string>,
        userText?: string,
        min_confidence: number = 0.7
    ): Promise<{ questions: DiagnosticQuestion[], confidence: number }> {
        const cacheKey = JSON.stringify({ category, answers, userText });

        if (questionCache.has(cacheKey)) {
            logger.info('⚡ [AI Cache Hit]: Returning cached questions');
            return questionCache.get(cacheKey)!;
        }

        if (inFlightQuestions.has(cacheKey)) {
            return inFlightQuestions.get(cacheKey)!;
        }

        const fetchPromise = (async () => {
            try {
                const { data, error } = await supabase.functions.invoke('generate-diagnostic-questions', {
                    body: { category, answers, userText, min_confidence }
                });

                if (error) {
                    logger.warn('AI generateQuestions non-fatal response', {
                        message: error.message,
                        name: error.name
                    });
                    return { questions: [], confidence: 0.8 };
                }

                const result = data as { questions: DiagnosticQuestion[], confidence: number };
                questionCache.set(cacheKey, result);
                return result;
            } catch (err: any) {
                logger.warn('AI generateQuestions network error handled gracefully', {
                    message: err?.message || 'Network error'
                });
                return { questions: [], confidence: 0.8 };
            } finally {
                inFlightQuestions.delete(cacheKey);
            }
        })();

        inFlightQuestions.set(cacheKey, fetchPromise);
        return fetchPromise;
    },

    /**
     * Call 'analyze-request' Edge Function
     * Should only be called after request is created with real requestId and coordinates
     */
    async analyzeRequest(payload: {
        requestId: string,
        category: string,
        answers: Record<string, string>,
        userText?: string,
        lat?: number,
        lng?: number
    }): Promise<any> {
        const requestKey = payload.requestId;

        if (analysisCache.has(requestKey)) {
            logger.info('⚡ [AI Cache Hit]: Returning cached analysis for request', { requestId: requestKey });
            return analysisCache.get(requestKey);
        }

        if (inFlightAnalysis.has(requestKey)) {
            return inFlightAnalysis.get(requestKey);
        }

        const fetchPromise = (async () => {
            try {
                const { data, error } = await supabase.functions.invoke('analyze-request', {
                    body: payload
                });

                if (error) {
                    logger.warn('AI analyzeRequest non-fatal error', {
                        message: error.message,
                        requestId: payload.requestId
                    });
                    return null;
                }

                if (data) {
                    analysisCache.set(requestKey, data);
                }

                return data;
            } catch (err: any) {
                logger.warn('AI analyzeRequest network error handled gracefully', {
                    message: err?.message || 'Network error',
                    requestId: payload.requestId
                });
                return null;
            } finally {
                inFlightAnalysis.delete(requestKey);
            }
        })();

        inFlightAnalysis.set(requestKey, fetchPromise);
        return fetchPromise;
    }
};
