import { supabase } from '@/services/supabase';

const CHAT_SEND_ENABLED_STATUSES = ['accepted', 'confirmed', 'en_route', 'arrived', 'quote_provided', 'quote_accepted'];
const INBOX_ENABLED_STATUSES = ['accepted', 'confirmed', 'en_route', 'arrived', 'quote_provided', 'quote_accepted', 'done', 'completed'];

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
  senderId: string;
  clientMessageId: string;
  text: string;
  direction: 'incoming' | 'outgoing';
  createdAt: string;
  readAt: string | null;
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

interface ChatMessageRow {
  id: string;
  request_id: string;
  sender_id: string;
  client_message_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
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
    id: partner?.id || '',
    name: partner?.full_name || 'Prestador',
    avatarUrl: partner?.avatar_url || null,
    rating: partner?.rating || null,
    category: partner?.service_category || null,
  };
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
    INBOX_ENABLED_STATUSES.includes(normalizeStatus(row.status))
  );
  const requestIds = requestRows.map((row: any) => row.id).filter(Boolean);

  if (requestIds.length === 0) {
    return [];
  }

  const { data: messageRows, error: messagesError } = await supabase
    .from('chat_messages')
    .select('id, request_id, sender_id, body, created_at, read_at')
    .in('request_id', requestIds)
    .order('created_at', { ascending: false });

  if (messagesError) {
    throw messagesError;
  }

  const latestByRequest = new Map<string, { body: string; created_at: string }>();
  const unreadByRequest = new Map<string, number>();

  for (const row of (messageRows || []) as { id: string; request_id: string; sender_id: string; body: string; created_at: string; read_at: string | null }[]) {
    const reqId = row.request_id;
    if (!reqId) continue;

    if (!latestByRequest.has(reqId)) {
      latestByRequest.set(reqId, { body: row.body, created_at: row.created_at });
    }

    if (row.sender_id !== userId && !row.read_at) {
      unreadByRequest.set(reqId, (unreadByRequest.get(reqId) || 0) + 1);
    }
  }

  const threadList: ChatThreadSummary[] = requestRows
    .map((row: any) => {
      if (!row.partners) return null;

      const latest = latestByRequest.get(row.id);

      return {
        requestId: row.id,
        status: normalizeStatus(row.status),
        category: row.category,
        provider: mapPartner(row.partners),
        updatedAt: row.updated_at,
        lastMessage: latest?.body || null,
        lastMessageAt: latest?.created_at || null,
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

  const { data: messageRows, error: messagesError } = await supabase
    .from('chat_messages')
    .select('id, request_id, sender_id, client_message_id, body, created_at, read_at')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (messagesError) {
    throw messagesError;
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
    canSend: CHAT_SEND_ENABLED_STATUSES.includes(normalizeStatus(requestRow.status)),
    doneProviderAt: requestRow.done_provider_at ?? null,
    doneClientAt: requestRow.done_client_at ?? null,
    hasClientReview: !!reviewRow,
  };

  // Deduplicação determinística por ID persistido
  const messageMap = new Map<string, ChatMessage>();
  for (const row of (messageRows || []) as ChatMessageRow[]) {
    if (!messageMap.has(row.id)) {
      messageMap.set(row.id, {
        id: row.id,
        requestId: row.request_id,
        senderId: row.sender_id,
        clientMessageId: row.client_message_id,
        text: row.body,
        direction: row.sender_id === userId ? 'outgoing' : 'incoming',
        createdAt: row.created_at,
        readAt: row.read_at,
        isRead: row.read_at !== null || row.sender_id === userId,
      });
    }
  }

  const messages = Array.from(messageMap.values()).sort((a, b) => {
    const tA = new Date(a.createdAt).getTime();
    const tB = new Date(b.createdAt).getTime();
    if (tA !== tB) return tA - tB;
    return a.id.localeCompare(b.id);
  });

  return { thread, messages };
}

export async function markChatThreadAsRead(requestId: string): Promise<number> {
  const { data, error } = await supabase.rpc('mark_chat_read_v1', {
    p_request_id: requestId,
  });

  if (error) {
    throw error;
  }

  return (data as number) ?? 0;
}

export async function sendChatMessage(requestId: string, rawMessage: string, clientMessageId: string): Promise<ChatMessage> {
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

  if (!clientMessageId) {
    throw new Error('Identificador da mensagem não informado.');
  }

  const { data, error } = await supabase.rpc('send_chat_message_v1', {
    p_request_id: requestId,
    p_message: content,
    p_client_message_id: clientMessageId,
  });

  if (error) {
    throw error;
  }

  const row = data as ChatMessageRow;
  return {
    id: row.id,
    requestId: row.request_id,
    senderId: row.sender_id,
    clientMessageId: row.client_message_id,
    text: row.body,
    direction: 'outgoing',
    createdAt: row.created_at,
    readAt: row.read_at,
    isRead: row.read_at !== null,
  };
}
