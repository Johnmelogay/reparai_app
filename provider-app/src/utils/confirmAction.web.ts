export type ConfirmActionOptions = {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
};

export function confirmAction({
    title,
    message,
}: ConfirmActionOptions): Promise<boolean> {
    const promptText = title ? `${title}\n\n${message}` : message;
    const confirmed = typeof globalThis.confirm === 'function' ? globalThis.confirm(promptText) : true;
    return Promise.resolve(Boolean(confirmed));
}
