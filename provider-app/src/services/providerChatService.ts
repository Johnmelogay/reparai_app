import { supabase } from '@/services/supabase';

const CHAT_TITLE_PREFIX = 'chat:v1';
const CHAT_ENABLED_STATUSES = ['accepted', 'confirmed', 'en_route', 'arrived', 'quote_provided', 'quote_accepted'];

function normalizeStatus(status: string | null | undefined): string {
    return (status || '').toLowerCase().trim();
}

export interface ProviderChatParticipant {
    id: string;
    name: string;
    avatarUrl: string | null;
}

export interface ProviderChatThreadSummary {
    requestId: string;
    status: string;
    category: string | null;
    client: ProviderChatParticipant;
    updatedAt: string;
    lastMessage: string | null;
    lastMessageAt: string | null;
    unreadCount: number;
}

export interface ProviderChatThreadDetail {
    requestId: string;
    status: string;
    category: string | null;
    description: string | null;
    address: string | null;
    createdAt: string;
    updatedAt: string;
    clientId: string;
    client: ProviderChatParticipant;
    canSend: boolean;
}

export interface ProviderChatMessage {
    id: string;
    requestId: string;
    text: string;
    direction: 'incoming' | 'outgoing';
    createdAt: string;
    isRead: boolean;
}

type NotificationRow = {
    id: string;
    user_id: string;
    title: string;
    message: string;
    related_id: string;
    is_read: boolean;
    created_at: string;
};

function parseChatMetaTitle(title?: string | null): { senderId: string | null; recipientId: string | null } {
    if (!title) return { senderId: null, recipientId: null };

    const parts = title.split(':');
    if (`${parts[0]}:${parts[1]}` !== CHAT_TITLE_PREFIX) return { senderId: null, recipientId: null };

    // Legacy format: chat:v1:<sender>:<recipient>
    if (parts.length === 4) {
        return {
            senderId: parts[2] || null,
            recipientId: parts[3] || null,
        };
    }

    // Current format: chat:v1:request:<sender>:<recipient>
    if (parts.length !== 5) return { senderId: null, recipientId: null };

    return {
        senderId: parts[3] || null,
        recipientId: parts[4] || null,
    };
}

function buildChatMetaTitle(senderId: string, recipientId: string): string {
    // Keep 5 segments for parser compatibility: chat:v1:request:<sender>:<recipient>
    return `${CHAT_TITLE_PREFIX}:request:${senderId}:${recipientId}`;
}

function sanitizeMessage(input: string): string {
    return input.replace(/\s+/g, ' ').trim();
}

function hasExternalContactSignal(message: string): boolean {
    const text = message.toLowerCase();
    const phoneRegex = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,3}\)?[\s-]?)?\d{4,5}[\s-]?\d{4}/;
    const emailRegex = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i;
    const urlRegex = /(https?:\/\/|www\.|wa\.me|t\.me|discord\.gg|instagram\.com|facebook\.com)/i;
    const offPlatformWords = ['whatsapp', 'telegram', 'instagram', 'facebook', 'discord', 'liga', 'me liga', 'chama no'];

    if (phoneRegex.test(text) || emailRegex.test(text) || urlRegex.test(text)) {
        return true;
    }

    return offPlatformWords.some((word) => text.includes(word));
}

function mapClient(client: any): ProviderChatParticipant {
    return {
        id: client?.id || '',
        name: client?.full_name || 'Cliente',
        avatarUrl: client?.avatar_url || null,
    };
}

async function trySendChatMessageViaRpc(requestId: string, message: string): Promise<boolean> {
    const { error } = await supabase.rpc('send_chat_message_v1', {
        p_request_id: requestId,
        p_message: message,
    });

    if (!error) return true;

    // Function missing on backend: keep compatibility with direct insert fallback.
    if (error.code === 'PGRST202' || error.code === '42883') return false;

    throw error;
}

export async function fetchProviderChatInbox(providerId: string): Promise<ProviderChatThreadSummary[]> {
    const { data: requests, error: requestsError } = await supabase
        .from('requests')
        .select(`
            id,
            status,
            category,
            updated_at,
            user_id,
            clients:user_id (
                id,
                full_name,
                avatar_url
            )
        `)
        .eq('provider_id', providerId)
        .order('updated_at', { ascending: false });

    if (requestsError) throw requestsError;

    const requestRows = (requests || []).filter((row: any) =>
        CHAT_ENABLED_STATUSES.includes(normalizeStatus(row.status))
    );
    const requestIds = requestRows.map((row: any) => row.id).filter(Boolean);
    if (requestIds.length === 0) return [];

    const { data: notifications, error: notificationsError } = await supabase
        .from('notifications')
        .select('id, user_id, title, message, related_id, is_read, created_at')
        .eq('user_id', providerId)
        .eq('type', 'message')
        .like('title', `${CHAT_TITLE_PREFIX}:%`)
        .in('related_id', requestIds)
        .order('created_at', { ascending: false });

    if (notificationsError) throw notificationsError;

    const latestByRequest = new Map<string, NotificationRow>();
    const unreadByRequest = new Map<string, number>();

    for (const row of (notifications || []) as NotificationRow[]) {
        if (!latestByRequest.has(row.related_id)) {
            latestByRequest.set(row.related_id, row);
        }
        if (!row.is_read) {
            unreadByRequest.set(row.related_id, (unreadByRequest.get(row.related_id) || 0) + 1);
        }
    }

    const threads = requestRows.map((row: any) => {
        const lastMessage = latestByRequest.get(row.id);
        return {
            requestId: row.id,
            status: normalizeStatus(row.status),
            category: row.category,
            client: mapClient(row.clients),
            updatedAt: row.updated_at,
            lastMessage: lastMessage?.message || null,
            lastMessageAt: lastMessage?.created_at || null,
            unreadCount: unreadByRequest.get(row.id) || 0,
        };
    });

    return threads.sort((a, b) => {
        const aTs = a.lastMessageAt || a.updatedAt;
        const bTs = b.lastMessageAt || b.updatedAt;
        return new Date(bTs).getTime() - new Date(aTs).getTime();
    });
}

export async function fetchProviderChatThread(providerId: string, requestId: string): Promise<{ thread: ProviderChatThreadDetail; messages: ProviderChatMessage[] }> {
    const { data: requestRow, error: requestError } = await supabase
        .from('requests')
        .select(`
            id,
            status,
            category,
            user_text,
            address,
            created_at,
            updated_at,
            user_id,
            clients:user_id (
                id,
                full_name,
                avatar_url
            )
        `)
        .eq('id', requestId)
        .eq('provider_id', providerId)
        .single();

    if (requestError) throw requestError;
    if (!requestRow || !requestRow.user_id) {
        throw new Error('Conversa não encontrada para este prestador.');
    }

    const { data: notificationRows, error: notificationsError } = await supabase
        .from('notifications')
        .select('id, user_id, title, message, related_id, is_read, created_at')
        .eq('user_id', providerId)
        .eq('type', 'message')
        .eq('related_id', requestId)
        .like('title', `${CHAT_TITLE_PREFIX}:%`)
        .order('created_at', { ascending: true });

    if (notificationsError) throw notificationsError;

    const thread: ProviderChatThreadDetail = {
        requestId: requestRow.id,
        status: normalizeStatus(requestRow.status),
        category: requestRow.category,
        description: requestRow.user_text,
        address: requestRow.address,
        createdAt: requestRow.created_at,
        updatedAt: requestRow.updated_at,
        clientId: requestRow.user_id,
        client: mapClient(requestRow.clients),
        canSend: CHAT_ENABLED_STATUSES.includes(normalizeStatus(requestRow.status)),
    };

    const messages: ProviderChatMessage[] = ((notificationRows || []) as NotificationRow[]).map((row) => {
        const { senderId } = parseChatMetaTitle(row.title);
        return {
            id: row.id,
            requestId,
            text: row.message,
            direction: senderId === providerId ? 'outgoing' : 'incoming',
            createdAt: row.created_at,
            isRead: row.is_read,
        };
    });

    return { thread, messages };
}

export async function markProviderChatThreadAsRead(providerId: string, requestId: string): Promise<void> {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', providerId)
        .eq('type', 'message')
        .eq('related_id', requestId)
        .eq('is_read', false);

    if (error) throw error;
}

export async function sendProviderChatMessage(providerId: string, requestId: string, rawMessage: string): Promise<void> {
    const content = sanitizeMessage(rawMessage);
    if (!content) throw new Error('Digite uma mensagem antes de enviar.');
    if (content.length > 1000) throw new Error('Mensagem muito longa. Limite de 1000 caracteres.');
    if (hasExternalContactSignal(content)) {
        throw new Error('Por segurança, o contato deve permanecer no chat do app. Remova telefone, e-mail, link ou convite externo.');
    }

    const sentByRpc = await trySendChatMessageViaRpc(requestId, content);
    if (sentByRpc) return;

    const { data: requestRow, error: requestError } = await supabase
        .from('requests')
        .select('id, user_id, provider_id, status')
        .eq('id', requestId)
        .eq('provider_id', providerId)
        .single();

    if (requestError || !requestRow || !requestRow.user_id) {
        throw requestError || new Error('Pedido não encontrado para envio da mensagem.');
    }

    if (!CHAT_ENABLED_STATUSES.includes(normalizeStatus(requestRow.status))) {
        throw new Error('O chat será liberado quando o pedido for confirmado com você.');
    }

    const title = buildChatMetaTitle(providerId, requestRow.user_id);
    const rows = [
        {
            user_id: providerId,
            title,
            message: content,
            type: 'message' as const,
            related_id: requestId,
            is_read: true,
        },
        {
            user_id: requestRow.user_id,
            title,
            message: content,
            type: 'message' as const,
            related_id: requestId,
            is_read: false,
        },
    ];

    const { error: insertError } = await supabase.from('notifications').insert(rows);
    if (insertError) throw insertError;
}
