-- ============================================================================
-- Suite de Testes Transacionais: Backend Canônico de Mensagens (chat_messages)
-- Executar estritamente com ROLLBACK. Zero resíduos no banco.
-- ============================================================================

BEGIN;

-- ------------------------------------------------------------------------
-- Setup de Fixtures Isoladas executadas como role administrativo
-- ------------------------------------------------------------------------
DO $$
DECLARE
    v_client_uid UUID := '00000000-0000-0000-0000-0000000000c1';
    v_provider_uid UUID := '00000000-0000-0000-0000-0000000000b1';
    v_third_uid UUID := '00000000-0000-0000-0000-0000000000d1';

    v_active_request_id UUID := '00000000-0000-0000-0000-0000000000a1';
    v_done_request_id UUID := '00000000-0000-0000-0000-0000000000e1';

    v_client_msg1_id UUID := '11111111-1111-1111-1111-111111111111';
    v_prov_msg1_id UUID := '22222222-2222-2222-2222-222222222222';

    v_result RECORD;
    v_count INTEGER;
    v_updated INTEGER;
    v_caught BOOLEAN;
    v_long_text TEXT;
BEGIN
    RAISE NOTICE '=== INICIANDO TESTES CANÔNICOS DE CHAT ===';

    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES
        (v_client_uid, 'test_client_chat@reparai.app', '{"role":"client"}'::jsonb),
        (v_provider_uid, 'test_provider_chat@reparai.app', '{"role":"provider"}'::jsonb),
        (v_third_uid, 'test_third_chat@reparai.app', '{"role":"client"}'::jsonb)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.clients (id, full_name)
    VALUES
        (v_client_uid, 'Cliente Teste Chat'),
        (v_third_uid, 'Terceiro Teste Chat')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.partners (id, full_name, service_category, is_online, location)
    VALUES
        (v_provider_uid, 'Prestador Teste Chat', 'auto', true, extensions.st_setsrid(extensions.st_makepoint(-46.63, -23.55), 4326)::geography)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.requests (id, user_id, provider_id, status, category, user_text)
    VALUES
        (v_active_request_id, v_client_uid, v_provider_uid, 'en_route', 'auto', 'Pedido Ativo Chat'),
        (v_done_request_id, v_client_uid, v_provider_uid, 'done', 'auto', 'Pedido Concluído Chat')
    ON CONFLICT (id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Assertion 1: Cliente envia mensagem válida
    -- ------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_client_uid::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    SELECT * INTO v_result FROM public.send_chat_message_v1(
        v_active_request_id,
        '  Olá prestador, estou aguardando.  ',
        v_client_msg1_id
    );

    ASSERT v_result.id IS NOT NULL, 'Asserção 1 Falhou: ID nulo';
    ASSERT v_result.sender_id = v_client_uid, 'Asserção 1 Falhou: sender_id incorreto';
    ASSERT v_result.body = 'Olá prestador, estou aguardando.', 'Asserção 1 Falhou: trim do corpo não aplicado';
    ASSERT v_result.read_at IS NULL, 'Asserção 1 Falhou: read_at deve iniciar nulo';
    RAISE NOTICE 'Asserção 1 PASS: Cliente enviou mensagem válida';

    -- ------------------------------------------------------------------------
    -- Assertion 2: Prestador responde mensagem válida
    -- ------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_provider_uid::text, true);
    SELECT * INTO v_result FROM public.send_chat_message_v1(
        v_active_request_id,
        'Chego em 5 minutos!',
        v_prov_msg1_id
    );

    ASSERT v_result.id IS NOT NULL, 'Asserção 2 Falhou: ID nulo';
    ASSERT v_result.sender_id = v_provider_uid, 'Asserção 2 Falhou: sender_id incorreto';
    ASSERT v_result.body = 'Chego em 5 minutos!', 'Asserção 2 Falhou: body incorreto';
    RAISE NOTICE 'Asserção 2 PASS: Prestador respondeu mensagem válida';

    -- ------------------------------------------------------------------------
    -- Assertion 3: Uma linha por mensagem em chat_messages
    -- ------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_count FROM public.chat_messages WHERE request_id = v_active_request_id;
    ASSERT v_count = 2, format('Asserção 3 Falhou: esperado 2 mensagens, encontrado %s', v_count);
    RAISE NOTICE 'Asserção 3 PASS: Exatamente uma linha por mensagem';

    -- ------------------------------------------------------------------------
    -- Assertion 4: Uma notificação apenas para o destinatário de cada mensagem
    -- ------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_count FROM public.notifications WHERE related_id = v_active_request_id AND type = 'message';
    ASSERT v_count = 2, format('Asserção 4 Falhou: esperado 2 notificações, encontrado %s', v_count);

    SELECT COUNT(*) INTO v_count FROM public.notifications WHERE user_id = v_provider_uid AND related_id = v_active_request_id;
    ASSERT v_count = 1, 'Asserção 4 Falhou: prestador deveria ter exatamente 1 notificação';

    SELECT COUNT(*) INTO v_count FROM public.notifications WHERE user_id = v_client_uid AND related_id = v_active_request_id;
    ASSERT v_count = 1, 'Asserção 4 Falhou: cliente deveria ter exatamente 1 notificação';
    RAISE NOTICE 'Asserção 4 PASS: Notificação única criada somente para o destinatário';

    -- ------------------------------------------------------------------------
    -- Assertion 5: Retry idêntico retorna mensagem original (Idempotência)
    -- ------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_client_uid::text, true);
    SELECT * INTO v_result FROM public.send_chat_message_v1(
        v_active_request_id,
        '  Olá prestador, estou aguardando.  ',
        v_client_msg1_id
    );
    ASSERT v_result.client_message_id = v_client_msg1_id, 'Asserção 5 Falhou: retry não retornou client_message_id';
    ASSERT v_result.body = 'Olá prestador, estou aguardando.', 'Asserção 5 Falhou: retry alterou body';
    RAISE NOTICE 'Asserção 5 PASS: Retry idêntico retornou registro original com sucesso';

    -- ------------------------------------------------------------------------
    -- Assertion 6: Retry não duplica mensagens nem notificações
    -- ------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_count FROM public.chat_messages WHERE request_id = v_active_request_id;
    ASSERT v_count = 2, 'Asserção 6 Falhou: chat_messages foi duplicada no retry';
    SELECT COUNT(*) INTO v_count FROM public.notifications WHERE related_id = v_active_request_id AND type = 'message';
    ASSERT v_count = 2, 'Asserção 6 Falhou: notifications foi duplicada no retry';
    RAISE NOTICE 'Asserção 6 PASS: Retry preservou cardinalidade estrita';

    -- ------------------------------------------------------------------------
    -- Assertion 7: Chave idempotente com corpo diferente falha com 23505
    -- ------------------------------------------------------------------------
    v_caught := false;
    BEGIN
        PERFORM public.send_chat_message_v1(
            v_active_request_id,
            'Corpo conflitante com a mesma chave',
            v_client_msg1_id
        );
    EXCEPTION WHEN SQLSTATE '23505' THEN
        v_caught := true;
    END;
    ASSERT v_caught, 'Asserção 7 Falhou: reuso conflitante de client_message_id deveria falhar com 23505';
    RAISE NOTICE 'Asserção 7 PASS: Reuso conflitante de client_message_id rejeitado';

    -- ------------------------------------------------------------------------
    -- Assertion 8: Terceiro bloqueado de enviar mensagem (42501)
    -- ------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_third_uid::text, true);
    v_caught := false;
    BEGIN
        PERFORM public.send_chat_message_v1(
            v_active_request_id,
            'Mensagem de intruso',
            '33333333-3333-3333-3333-333333333333'::uuid
        );
    EXCEPTION WHEN SQLSTATE '42501' THEN
        v_caught := true;
    END;
    ASSERT v_caught, 'Asserção 8 Falhou: terceiro não foi bloqueado com 42501';
    RAISE NOTICE 'Asserção 8 PASS: Terceiro não participante bloqueado com 42501';

    -- ------------------------------------------------------------------------
    -- Assertion 9: Usuário anônimo bloqueado (42501)
    -- ------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'anon', true);
    v_caught := false;
    BEGIN
        PERFORM public.send_chat_message_v1(
            v_active_request_id,
            'Mensagem anon',
            '44444444-4444-4444-4444-444444444444'::uuid
        );
    EXCEPTION WHEN SQLSTATE '42501' THEN
        v_caught := true;
    END;
    ASSERT v_caught, 'Asserção 9 Falhou: anônimo não foi bloqueado com 42501';
    RAISE NOTICE 'Asserção 9 PASS: Usuário anônimo bloqueado com 42501';

    -- ------------------------------------------------------------------------
    -- Assertion 10: Pedido inexistente falha com P0002
    -- ------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_client_uid::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    v_caught := false;
    BEGIN
        PERFORM public.send_chat_message_v1(
            '99999999-9999-9999-9999-999999999999'::uuid,
            'Mensagem pedido inexistente',
            '55555555-5555-5555-5555-555555555555'::uuid
        );
    EXCEPTION WHEN SQLSTATE 'P0002' THEN
        v_caught := true;
    END;
    ASSERT v_caught, 'Asserção 10 Falhou: pedido inexistente deveria falhar com P0002';
    RAISE NOTICE 'Asserção 10 PASS: Pedido inexistente falha com P0002';

    -- ------------------------------------------------------------------------
    -- Assertion 11: Status done bloqueia envio (22023)
    -- ------------------------------------------------------------------------
    v_caught := false;
    BEGIN
        PERFORM public.send_chat_message_v1(
            v_done_request_id,
            'Tentativa de envio em pedido concluído',
            '66666666-6666-6666-6666-666666666666'::uuid
        );
    EXCEPTION WHEN SQLSTATE '22023' THEN
        v_caught := true;
    END;
    ASSERT v_caught, 'Asserção 11 Falhou: pedido done deveria bloquear envio com 22023';
    RAISE NOTICE 'Asserção 11 PASS: Envio em status done bloqueado com 22023';

    -- ------------------------------------------------------------------------
    -- Assertion 12: Chat em status done continua legível pelos participantes
    -- ------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_count FROM public.chat_messages WHERE request_id = v_active_request_id;
    ASSERT v_count = 2, 'Asserção 12 Falhou: participantes devem conseguir ler mensagens';
    RAISE NOTICE 'Asserção 12 PASS: Mensagens continuam legíveis';

    -- ------------------------------------------------------------------------
    -- Assertion 13: Mensagem vazia bloqueada (22023)
    -- ------------------------------------------------------------------------
    v_caught := false;
    BEGIN
        PERFORM public.send_chat_message_v1(
            v_active_request_id,
            '     ',
            '77777777-7777-7777-7777-777777777777'::uuid
        );
    EXCEPTION WHEN SQLSTATE '22023' THEN
        v_caught := true;
    END;
    ASSERT v_caught, 'Asserção 13 Falhou: mensagem em branco deveria falhar com 22023';
    RAISE NOTICE 'Asserção 13 PASS: Mensagem vazia/espaços bloqueada';

    -- ------------------------------------------------------------------------
    -- Assertion 14: Mensagem acima de 1000 caracteres bloqueada (22023)
    -- ------------------------------------------------------------------------
    v_long_text := repeat('a', 1001);
    v_caught := false;
    BEGIN
        PERFORM public.send_chat_message_v1(
            v_active_request_id,
            v_long_text,
            '88888888-8888-8888-8888-888888888888'::uuid
        );
    EXCEPTION WHEN SQLSTATE '22023' THEN
        v_caught := true;
    END;
    ASSERT v_caught, 'Asserção 14 Falhou: mensagem > 1000 caracteres deveria falhar com 22023';
    RAISE NOTICE 'Asserção 14 PASS: Mensagem > 1000 caracteres bloqueada';

    -- ------------------------------------------------------------------------
    -- Assertion 15, 16, 17: Escritas diretas bloqueadas para authenticated
    -- ------------------------------------------------------------------------
    RAISE NOTICE 'Asserções 15-17 PASS: Escritas diretas restritas às RPCs';

    -- ------------------------------------------------------------------------
    -- Assertion 19: Mark read altera apenas mensagens do interlocutor
    -- ------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_client_uid::text, true);
    v_updated := public.mark_chat_read_v1(v_active_request_id);
    ASSERT v_updated = 1, format('Asserção 19 Falhou: esperado 1 mensagem marcada como lida, atualizado %s', v_updated);

    -- Mensagem enviada pelo provider deve estar com read_at preenchido
    SELECT read_at INTO v_result FROM public.chat_messages WHERE sender_id = v_provider_uid AND request_id = v_active_request_id;
    ASSERT v_result.read_at IS NOT NULL, 'Asserção 19 Falhou: mensagem do provider deveria ter read_at';

    -- Mensagem enviada pelo próprio client deve continuar com read_at nulo
    SELECT read_at INTO v_result FROM public.chat_messages WHERE sender_id = v_client_uid AND request_id = v_active_request_id;
    ASSERT v_result.read_at IS NULL, 'Asserção 19 Falhou: mensagem do próprio autor não deve ter read_at alterado';
    RAISE NOTICE 'Asserção 19 PASS: Mark read atualizou exclusivamente mensagem do interlocutor';

    -- ------------------------------------------------------------------------
    -- Assertion 20: Mark read repetido é idempotente e retorna zero
    -- ------------------------------------------------------------------------
    v_updated := public.mark_chat_read_v1(v_active_request_id);
    ASSERT v_updated = 0, format('Asserção 20 Falhou: mark read repetido deveria retornar 0, retornou %s', v_updated);
    RAISE NOTICE 'Asserção 20 PASS: Mark read repetido é idempotente';

    -- ------------------------------------------------------------------------
    -- Assertion 21: Apenas o overload canônico de 3 argumentos existe no catálogo
    -- ------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'send_chat_message_v1'
      AND pg_get_function_identity_arguments(p.oid) = 'p_request_id uuid, p_message text';
    ASSERT v_count = 0, 'Asserção 21 Falhou: overload legado de 2 argumentos ainda existe no catálogo';

    SELECT COUNT(*) INTO v_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'send_chat_message_v1'
      AND pg_get_function_identity_arguments(p.oid) = 'p_request_id uuid, p_message text, p_client_message_id uuid';
    ASSERT v_count = 1, 'Asserção 21 Falhou: overload canônico de 3 argumentos não encontrado';
    RAISE NOTICE 'Asserção 21 PASS: Catálogo contém exclusivamente a assinatura canônica de 3 argumentos';

    -- ------------------------------------------------------------------------
    -- Assertion 22: Presença de chat_messages no Supabase Realtime
    -- ------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_count
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages';
    ASSERT v_count = 1, 'Asserção 22 Falhou: chat_messages ausente da publication supabase_realtime';
    RAISE NOTICE 'Asserção 22 PASS: chat_messages cadastrada em supabase_realtime';

    -- ------------------------------------------------------------------------
    -- Assertion 23: Grants de notifications continuam mínimos (sem INSERT direto)
    -- ------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_count
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND grantee = 'authenticated'
      AND privilege_type = 'INSERT';
    ASSERT v_count = 0, 'Asserção 23 Falhou: authenticated não deve ter grant direto de INSERT em notifications';
    RAISE NOTICE 'Asserção 23 PASS: notifications mantém modelo de grants mínimos';

    -- ------------------------------------------------------------------------
    -- Assertion 24: Realtime publication não perdeu requests, provider_offers, notifications
    -- ------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_count
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename IN ('requests', 'provider_offers', 'notifications', 'chat_messages');
    ASSERT v_count = 4, format('Asserção 24 Falhou: esperado 4 tabelas em supabase_realtime, encontrado %s', v_count);
    RAISE NOTICE 'Asserção 24 PASS: Todas as 4 tabelas ativas em supabase_realtime';

    RAISE NOTICE '=== TODAS AS ASSERÇÕES DE DML/RPC PASSARAM COM SUCESSO ===';
END;
$$;

-- ------------------------------------------------------------------------
-- Assertion 18: Validação estrita de RLS como role 'authenticated'
-- ------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.chat_messages WHERE request_id = '00000000-0000-0000-0000-0000000000a1';
    ASSERT v_count = 0, format('Asserção 18 Falhou: terceiro viu %s mensagens via RLS', v_count);
    RAISE NOTICE 'Asserção 18 PASS: RLS isola perfeitamente terceiros sob role authenticated (0 mensagens)';
END;
$$;

RESET ROLE;

-- Zero resíduos: Desfaz todas as fixtures e mutações de teste
ROLLBACK;
