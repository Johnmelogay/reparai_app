export function toErrorMessage(error: unknown, fallback = 'Erro inesperado.'): string {
    if (!error) return fallback;

    if (error instanceof Error) {
        return error.message || fallback;
    }

    if (typeof error === 'string') {
        return error || fallback;
    }

    if (typeof error === 'object') {
        const maybe = error as {
            message?: unknown;
            details?: unknown;
            hint?: unknown;
            code?: unknown;
            error_description?: unknown;
        };

        const parts: string[] = [];
        if (typeof maybe.message === 'string' && maybe.message.trim()) parts.push(maybe.message.trim());
        if (typeof maybe.details === 'string' && maybe.details.trim()) parts.push(maybe.details.trim());
        if (typeof maybe.hint === 'string' && maybe.hint.trim()) parts.push(`Dica: ${maybe.hint.trim()}`);
        if (typeof maybe.error_description === 'string' && maybe.error_description.trim()) {
            parts.push(maybe.error_description.trim());
        }

        if (parts.length > 0) return parts.join(' ');
        if (typeof maybe.code === 'string' && maybe.code.trim()) return `Erro (${maybe.code.trim()}).`;
    }

    return fallback;
}

