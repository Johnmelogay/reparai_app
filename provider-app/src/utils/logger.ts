const PREFIX = '[ReparaiProvider]';

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
