-- ============================================================================
-- Patch Atômico Chat 1: Backend Canônico de Mensagens (public.chat_messages)
-- ============================================================================

-- 1. Neutralização de overloads legados
DROP FUNCTION IF EXISTS public.send_chat_message_v1(uuid, text);
DROP FUNCTION IF EXISTS public.send_chat_message_v1(uuid, text, uuid);

-- 2. Criação da tabela canônica chat_messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    client_message_id UUID NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ NULL,

    -- Constraints de integridade e tamanho
    CONSTRAINT chat_messages_body_check CHECK (
        char_length(body) BETWEEN 1 AND 1000
        AND body = btrim(body)
    ),
    -- Idempotência estrita por remetente
    CONSTRAINT chat_messages_sender_client_msg_uniq UNIQUE (sender_id, client_message_id)
);

-- 3. Índices de alta performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_request_created
    ON public.chat_messages (request_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_unread
    ON public.chat_messages (request_id, sender_id)
    WHERE read_at IS NULL;

-- 4. RLS e Políticas de Segurança
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_messages_select_participants" ON public.chat_messages;
CREATE POLICY "chat_messages_select_participants"
    ON public.chat_messages
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.requests r
            WHERE r.id = chat_messages.request_id
              AND (r.user_id = auth.uid() OR r.provider_id = auth.uid())
        )
    );

-- Bloqueio total de escritas diretas; mutations exclusivamente via RPCs
REVOKE ALL ON TABLE public.chat_messages FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.chat_messages TO authenticated;

-- 5. RPC de Envio Atômica com Idempotência Concorrente
CREATE OR REPLACE FUNCTION public.send_chat_message_v1(
    p_request_id UUID,
    p_message TEXT,
    p_client_message_id UUID
)
RETURNS public.chat_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
    v_current_uid UUID := auth.uid();
    v_request_row RECORD;
    v_recipient_uid UUID;
    v_normalized_status TEXT;
    v_sanitized_message TEXT;
    v_existing_msg public.chat_messages%ROWTYPE;
    v_inserted_msg public.chat_messages%ROWTYPE;
BEGIN
    -- 1. Autenticação obrigatória
    IF v_current_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    IF p_client_message_id IS NULL THEN
        RAISE EXCEPTION 'client_message_id is required' USING ERRCODE = '22023';
    END IF;

    -- 2. Sanitização do corpo da mensagem
    v_sanitized_message := btrim(COALESCE(p_message, ''));

    IF v_sanitized_message = '' THEN
        RAISE EXCEPTION 'Message is empty' USING ERRCODE = '22023';
    END IF;

    IF char_length(v_sanitized_message) > 1000 THEN
        RAISE EXCEPTION 'Message too long' USING ERRCODE = '22023';
    END IF;

    -- 3. Validação do pedido e participantes
    SELECT r.id, r.user_id, r.provider_id, r.status
    INTO v_request_row
    FROM public.requests r
    WHERE r.id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_request_row.provider_id IS NULL THEN
        RAISE EXCEPTION 'Request has no provider assigned' USING ERRCODE = '22023';
    END IF;

    IF v_current_uid <> v_request_row.user_id AND v_current_uid <> v_request_row.provider_id THEN
        RAISE EXCEPTION 'Not allowed to message this request' USING ERRCODE = '42501';
    END IF;

    -- 4. Validação da máquina de estados (apenas estados com atendimento ativo)
    v_normalized_status := lower(COALESCE(v_request_row.status, ''));
    IF v_normalized_status NOT IN ('accepted', 'confirmed', 'en_route', 'arrived', 'quote_provided', 'quote_accepted') THEN
        RAISE EXCEPTION 'Chat unavailable for current request status' USING ERRCODE = '22023';
    END IF;

    v_recipient_uid := CASE
        WHEN v_current_uid = v_request_row.user_id THEN v_request_row.provider_id
        ELSE v_request_row.user_id
    END;

    -- 5. Inserção atômica com resolução de conflito concorrente
    INSERT INTO public.chat_messages (
        request_id,
        sender_id,
        client_message_id,
        body,
        created_at,
        read_at
    )
    VALUES (
        p_request_id,
        v_current_uid,
        p_client_message_id,
        v_sanitized_message,
        now(),
        NULL
    )
    ON CONFLICT (sender_id, client_message_id) DO NOTHING
    RETURNING * INTO v_inserted_msg;

    -- 6. Caso a mensagem tenha sido inserida com sucesso (primeira tentativa)
    IF v_inserted_msg.id IS NOT NULL THEN
        -- Insere exatamente uma notificação genérica de alerta para o destinatário
        INSERT INTO public.notifications (
            user_id,
            title,
            message,
            type,
            related_id,
            is_read
        )
        VALUES (
            v_recipient_uid,
            'Nova mensagem',
            'Você recebeu uma nova mensagem no atendimento.',
            'message',
            p_request_id,
            false
        );

        RETURN v_inserted_msg;
    END IF;

    -- 7. Conflito de client_message_id detectado: recuperar mensagem original existente
    SELECT *
    INTO v_existing_msg
    FROM public.chat_messages m
    WHERE m.sender_id = v_current_uid
      AND m.client_message_id = p_client_message_id;

    -- Se o mesmo client_message_id foi reenviado para outro pedido ou com outro corpo -> Rejeitar colisão
    IF v_existing_msg.request_id <> p_request_id OR v_existing_msg.body <> v_sanitized_message THEN
        RAISE EXCEPTION 'Idempotency key collision with conflicting payload' USING ERRCODE = '23505';
    END IF;

    -- Retry idêntico: retorna a mensagem existente sem criar nova notificação
    RETURN v_existing_msg;
END;
$$;

REVOKE ALL ON FUNCTION public.send_chat_message_v1(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_chat_message_v1(UUID, TEXT, UUID) TO authenticated;

-- 6. RPC de Leitura / Confirmação de Leitura
CREATE OR REPLACE FUNCTION public.mark_chat_read_v1(
    p_request_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_current_uid UUID := auth.uid();
    v_request_row RECORD;
    v_updated_count INTEGER := 0;
BEGIN
    IF v_current_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    -- Validação do pedido e participação (permite leitura mesmo após done)
    SELECT r.id, r.user_id, r.provider_id
    INTO v_request_row
    FROM public.requests r
    WHERE r.id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_current_uid <> v_request_row.user_id AND v_current_uid <> v_request_row.provider_id THEN
        RAISE EXCEPTION 'Not allowed to access this chat' USING ERRCODE = '42501';
    END IF;

    -- Marca como lidas somente as mensagens enviadas pela outra parte
    UPDATE public.chat_messages
    SET read_at = now()
    WHERE request_id = p_request_id
      AND sender_id <> v_current_uid
      AND read_at IS NULL;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    -- Marca como lidas notificações do tipo message desse usuário/pedido
    UPDATE public.notifications
    SET is_read = true
    WHERE user_id = v_current_uid
      AND related_id = p_request_id
      AND type = 'message'
      AND is_read = false;

    RETURN v_updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_chat_read_v1(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_chat_read_v1(UUID) TO authenticated;

-- 7. Adição de chat_messages à publication supabase_realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'chat_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    END IF;
END;
$$;
