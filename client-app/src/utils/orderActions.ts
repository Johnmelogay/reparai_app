export const CLIENT_ACTION_REQUIRED_STATUSES = ['offered'] as const;

export type ClientActionStatus = (typeof CLIENT_ACTION_REQUIRED_STATUSES)[number];

export function needsClientAction(status?: string | null): boolean {
    if (!status) return false;
    return CLIENT_ACTION_REQUIRED_STATUSES.includes(status as ClientActionStatus);
}

export function getClientActionLabel(status?: string | null): string {
    switch (status) {
        case 'offered':
            return 'Escolha um profissional para continuar';
        case 'accepted':
            return 'Pedido confirmado. Abra o chat para alinhar o atendimento';
        default:
            return 'Ação pendente no pedido';
    }
}
