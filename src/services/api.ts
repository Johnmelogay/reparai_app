import { Provider, Category, Ticket } from '@/types';
import { NEARBY_PROVIDERS, CATEGORIES } from './mockData';

/**
 * API Client Stub
 * 
 * This layer simulates the backend API.
 * In production, this would be a Node.js/Express server communicating with Redis and a Database.
 */

// Simulated Network Delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
    providers: {
        /**
         * GET /v1/providers/nearby
         * 
         * CACHE STRATEGY (Redis):
         * - Key: `nearby:{lat}:{lng}:{radius}:{category}`
         * - TTL: 60 seconds (Hot data)
         * - Logic: Check Redis. If miss, query PostGIS/Spatial DB, write to Redis, return.
         */
        getNearby: async (latitude: number, longitude: number): Promise<Provider[]> => {
            console.log(`[API] Fetching nearby providers at ${latitude}, ${longitude}`);
            console.log(`[Redis] Checking cache key: nearby:${latitude}:${longitude}:5000:all`);

            // Simulate API latency
            await delay(800);

            console.log(`[Redis] Cache MISS. Querying DB...`);
            // Return mock data
            return NEARBY_PROVIDERS;
        },

        /**
         * GET /v1/providers/:id
         * 
         * CACHE STRATEGY (Redis):
         * - Key: `provider:{id}`
         * - TTL: 300 seconds
         */
        getById: async (id: string): Promise<Provider | undefined> => {
            console.log(`[API] Fetching provider ${id}`);
            await delay(500);
            return NEARBY_PROVIDERS.find(p => p.id === id);
        }
    },

    categories: {
        /**
         * GET /v1/categories
         * 
         * CACHE STRATEGY (Redis):
         * - Key: `categories:all`
         * - TTL: 24 hours (Static data)
         */
        getAll: async (): Promise<Category[]> => {
            await delay(200);
            return CATEGORIES;
        }
    },

    requests: {
        create: async (data: any) => {
            console.log('[API] Creating request', data);
            await delay(1000);
            return { success: true, id: 'req_123' };
        }
    }
};
