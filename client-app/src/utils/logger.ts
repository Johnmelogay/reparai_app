/**
 * AppLogger — Standardized logging utility for Reparaí.
 *
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.info('Partners loaded', { count: 20 });
 *   logger.warn('Slow response', { ms: 3200 });
 *   logger.error('RPC failed', error);
 */

const PREFIX = '[Reparai]';

function formatArgs(message: string, data?: unknown): string {
    if (data !== undefined) {
        if (data instanceof Error) {
            return `${PREFIX} ${message} ${data.message}\n${data.stack || ''}`;
        }
        try {
            const serialized = JSON.stringify(data, null, 2);
            return `${PREFIX} ${message} ${serialized}`;
        } catch {
            return `${PREFIX} ${message} [unserializable data]`;
        }
    }
    return `${PREFIX} ${message}`;
}

export const logger = {
    info(message: string, data?: unknown) {
        console.log(formatArgs(message, data));
    },

    warn(message: string, data?: unknown) {
        console.warn(formatArgs(message, data));
    },

    error(message: string, data?: unknown) {
        console.error(formatArgs(message, data));
    },
};
