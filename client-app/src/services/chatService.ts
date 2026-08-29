import { supabase } from '@/services/supabase';

const CHAT_TITLE_PREFIX = 'chat:v1';
const CHAT_ENABLED_STATUSES = ['accepted', 'confirmed', 'en_route', 'arrived', 'quote_provided', 'quote_accepted'];

function normalizeStatus(status: string | null | undefined): string {
  return (status || '').toLowerCase().trim();
}

export interface ChatParticipant {
  id: string;
  name: string;
  avatarUrl: string | null;
  rating: number | null;
  category: string | null;
}

export interface ChatMessage {
  id: string;
  requestId: string;
  text: string;
  direction: 'incoming' | 'outgoing';
  createdAt: string;
  isRead: boolean;
}

export interface ChatThreadSummary {
  requestId: string;
  status: string;
  category: string | null;
  provider: ChatParticipant;
  updatedAt: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface ChatThreadDetail {
  requestId: string;
  status: string;
  category: string | null;
  description: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
  providerId: string | null;
  provider: ChatParticipant | null;
  canSend: boolean;
  /** Set by provider when they mark the job done */
  doneProviderAt: string | null;
  /** Set by client when they confirm completion */
  doneClientAt: string | null;
  /** Whether the current client has already submitted a review */
  hasClientReview: boolean;
}

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  related_id: string;
  is_read: boolean;
  created_at: string;
}

function buildChatMetaTitle(senderId: string, recipientId: string): string {
  // Canonical format: chat:v1:request:<sender>:<recipient>
  return `${CHAT_TITLE_PREFIX}:request:${senderId}:${recipientId}`;
}

function parseChatMetaTitle(title?: string | null): { senderId: string | null; recipientId: string | null } {
  if (!title) {
    return { senderId: null, recipientId: null };
  }

  const parts = title.split(':');
  if (`${parts[0]}:${parts[1]}` !== CHAT_TITLE_PREFIX) {
    return { senderId: null, recipientId: null };
  }

  // Legacy format: chat:v1:<sender>:<recipient>
  if (parts.length === 4) {
    return {
      senderId: parts[2] || null,
      recipientId: parts[3] || null,
    };
  }

  if (parts.length !== 5) {
    return { senderId: null, recipientId: null };
  }

  return {
    senderId: parts[3] || null,
    recipientId: parts[4] || null,
  };
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

function mapPartner(partner: any): ChatParticipant {
  return {
    id: partner.id,
    name: partner.full_name || 'Prestador',
    avatarUrl: partner.avatar_url || null,
    rating: partner.rating || null,
    category: partner.service_category || null,
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

export async function fetchChatInbox(userId: string): Promise<ChatThreadSummary[]> {
  const { data: requests, error: requestsError } = await supabase
    .from('requests')
    .select(`
      id,
      status,
      category,
      updated_at,
      provider_id,
      partners:provider_id (
        id,
        full_name,
        avatar_url,
        rating,
        service_category
      )
    `)
    .eq('user_id', userId)
    .not('provider_id', 'is', null)
    .order('updated_at', { ascending: false });

  if (requestsError) {
    throw requestsError;
  }

  const requestRows = (requests || []).filter((row: any) =>
    CHAT_ENABLED_STATUSES.includes(normalizeStatus(row.status))
  );
  const requestIds = requestRows.map((row: any) => row.id).filter(Boolean);

  if (requestIds.length === 0) {
    return [];
  }

  const { data: notificationData, error: notificationError } = await supabase
    .from('notifications')
    .select('id, user_id, title, message, related_id, is_read, created_at')
    .eq('user_id', userId)
    .eq('type', 'message')
    .like('title', `${CHAT_TITLE_PREFIX}:%`)
    .in('related_id', requestIds)
    .order('created_at', { ascending: false });

  if (notificationError) {
    throw notificationError;
  }

  const latestByRequest = new Map<string, NotificationRow>();
  const unreadByRequest = new Map<string, number>();

  for (const row of (notificationData || []) as NotificationRow[]) {
    const reqId = row.related_id;
    if (!reqId) continue;

    if (!latestByRequest.has(reqId)) {
      latestByRequest.set(reqId, row);
    }

    if (!row.is_read) {
      unreadByRequest.set(reqId, (unreadByRequest.get(reqId) || 0) + 1);
    }
  }

  const threadList: ChatThreadSummary[] = requestRows
    .map((row: any) => {
      if (!row.partners) return null;

      const lastMessage = latestByRequest.get(row.id);

      return {
        requestId: row.id,
        status: normalizeStatus(row.status),
        category: row.category,
        provider: mapPartner(row.partners),
        updatedAt: row.updated_at,
        lastMessage: lastMessage?.message || null,
        lastMessageAt: lastMessage?.created_at || null,
        unreadCount: unreadByRequest.get(row.id) || 0,
      };
    })
    .filter(Boolean) as ChatThreadSummary[];

  return threadList.sort((a, b) => {
    const aTs = a.lastMessageAt || a.updatedAt;
    const bTs = b.lastMessageAt || b.updatedAt;
    return new Date(bTs).getTime() - new Date(aTs).getTime();
  });
}

export async function fetchChatThread(userId: string, requestId: string): Promise<{ thread: ChatThreadDetail; messages: ChatMessage[] }> {
  const [{ data: requestRow, error: requestError }, { data: reviewRow }] = await Promise.all([
    supabase
      .from('requests')
      .select(`
        id,
        status,
        category,
        user_text,
        address,
        created_at,
        updated_at,
        provider_id,
        done_provider_at,
        done_client_at,
        partners:provider_id (
          id,
          full_name,
          avatar_url,
          rating,
          service_category
        )
      `)
      .eq('id', requestId)
      .eq('user_id', userId)
      .single(),
    supabase
      .from('reviews')
      .select('id')
      .eq('request_id', requestId)
      .eq('reviewer_id', userId)
      .maybeSingle(),
  ]);

  if (requestError) {
    throw requestError;
  }

  if (!requestRow) {
    throw new Error('Pedido não encontrado para este usuário.');
  }

  const { data: notificationRows, error: notificationsError } = await supabase
    .from('notifications')
    .select('id, user_id, title, message, related_id, is_read, created_at')
    .eq('user_id', userId)
    .eq('type', 'message')
    .eq('related_id', requestId)
    .like('title', `${CHAT_TITLE_PREFIX}:%`)
    .order('created_at', { ascending: true });

  if (notificationsError) {
    throw notificationsError;
  }

  const thread: ChatThreadDetail = {
    requestId: requestRow.id,
    status: normalizeStatus(requestRow.status),
    category: requestRow.category,
    description: requestRow.user_text,
    address: requestRow.address,
    createdAt: requestRow.created_at,
    updatedAt: requestRow.updated_at,
    providerId: requestRow.provider_id,
    provider: requestRow.partners ? mapPartner(requestRow.partners) : null,
    canSend: CHAT_ENABLED_STATUSES.includes(normalizeStatus(requestRow.status)),
    doneProviderAt: requestRow.done_provider_at ?? null,
    doneClientAt: requestRow.done_client_at ?? null,
    hasClientReview: !!reviewRow,
  };

  const messages: ChatMessage[] = ((notificationRows || []) as NotificationRow[]).map((row) => {
    const { senderId } = parseChatMetaTitle(row.title);
    return {
      id: row.id,
      requestId,
      text: row.message,
      direction: senderId === userId ? 'outgoing' : 'incoming',
      createdAt: row.created_at,
      isRead: row.is_read,
    };
  });

  return { thread, messages };
}

export async function markChatThreadAsRead(userId: string, requestId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('type', 'message')
    .eq('related_id', requestId)
    .eq('is_read', false);

  if (error) {
    throw error;
  }
}

export async function sendChatMessage(userId: string, requestId: string, rawMessage: string): Promise<void> {
  const content = sanitizeMessage(rawMessage);

  if (!content) {
    throw new Error('Digite uma mensagem antes de enviar.');
  }

  if (content.length > 1000) {
    throw new Error('Mensagem muito longa. Limite de 1000 caracteres.');
  }

  if (hasExternalContactSignal(content)) {
    throw new Error('Por segurança, o contato deve permanecer no chat do app. Remova telefone, e-mail, link ou convite externo.');
  }

  const sentByRpc = await trySendChatMessageViaRpc(requestId, content);
  if (sentByRpc) return;

  const { data: requestRow, error: requestError } = await supabase
    .from('requests')
    .select('id, user_id, provider_id, status')
    .eq('id', requestId)
    .eq('user_id', userId)
    .single();

  if (requestError || !requestRow) {
    throw requestError || new Error('Pedido não encontrado para envio de mensagem.');
  }

  if (!requestRow.provider_id) {
    throw new Error('Ainda não há prestador vinculado a este pedido.');
  }

  if (!CHAT_ENABLED_STATUSES.includes(normalizeStatus(requestRow.status))) {
    throw new Error('O chat será liberado após a confirmação com um profissional.');
  }

  const recipientId = requestRow.provider_id;
  const title = buildChatMetaTitle(userId, recipientId);

  const rows = [
    {
      user_id: userId,
      title,
      message: content,
      type: 'message' as const,
      related_id: requestId,
      is_read: true,
    },
    {
      user_id: recipientId,
      title,
      message: content,
      type: 'message' as const,
      related_id: requestId,
      is_read: false,
    },
  ];

  const { error: insertError } = await supabase
    .from('notifications')
    .insert(rows);

  if (insertError) {
    throw insertError;
  }
}
