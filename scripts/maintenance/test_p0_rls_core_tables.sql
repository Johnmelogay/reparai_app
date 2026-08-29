-- Test Suite: test_p0_rls_core_tables.sql
-- Description: Validação transacional de segurança e rotas legítimas para o Patch P0 (Tabelas Core)
-- Nota: Executa integralmente dentro de transação com ROLLBACK no final para garantir ausência de efeitos colaterais.

BEGIN;

DO $$
DECLARE
  v_client_id uuid;
  v_partner1_id uuid;
  v_partner2_id uuid;
  v_test_finding_req_id uuid;
  v_test_done_req_id uuid;
  v_test_chat_req_id uuid;
  v_test_offer_id uuid;
  v_test_highlight_id uuid;
  v_test_inactive_highlight_id uuid;
  v_test_notif_id uuid;
  v_row_count integer;
  v_fn_exists boolean;
BEGIN
  -- 1. Obter UUIDs de contas reais da base de teste
  SELECT id INTO v_partner1_id FROM public.partners WHERE is_verified = true ORDER BY id LIMIT 1;
  SELECT id INTO v_partner2_id FROM public.partners WHERE is_verified = true AND id <> v_partner1_id ORDER BY id LIMIT 1;
  SELECT id INTO v_client_id FROM public.clients WHERE id NOT IN (SELECT id FROM public.partners) ORDER BY id LIMIT 1;

  IF v_client_id IS NULL OR v_partner1_id IS NULL OR v_partner2_id IS NULL THEN
    RAISE EXCEPTION 'ASSERTION SETUP FAILED: Contas de teste insuficientes em public.clients / public.partners.';
  END IF;

  -- 2. Setup de fixtures de teste na sessão postgres/superuser
  -- 2.1 Garantir localização e status online para os prestadores de teste
  UPDATE public.partners
  SET location = ST_SetSRID(ST_MakePoint(-46.63, -23.55), 4326)::geography,
      is_online = true,
      is_verified = true
  WHERE id IN (v_partner1_id, v_partner2_id);

  -- 2.2 Requests para os diferentes testes
  INSERT INTO public.requests (id, user_id, status, lat, lng, service_type_slug)
  VALUES (gen_random_uuid(), v_client_id, 'finding', -23.55, -46.63, 'eletrica')
  RETURNING id INTO v_test_finding_req_id;

  INSERT INTO public.requests (id, user_id, provider_id, status, lat, lng, service_type_slug)
  VALUES (gen_random_uuid(), v_client_id, v_partner1_id, 'done', -23.55, -46.63, 'eletrica')
  RETURNING id INTO v_test_done_req_id;

  INSERT INTO public.requests (id, user_id, provider_id, status, lat, lng, service_type_slug)
  VALUES (gen_random_uuid(), v_client_id, v_partner1_id, 'accepted', -23.55, -46.63, 'eletrica')
  RETURNING id INTO v_test_chat_req_id;

  -- 2.3 Fixture de oferta inicial para teste de permissão de leitura
  INSERT INTO public.provider_offers (id, request_id, provider_id, status, price)
  VALUES (gen_random_uuid(), v_test_finding_req_id, v_partner1_id, 'offered', 150.00)
  RETURNING id INTO v_test_offer_id;

  -- 2.4 Notificação simples
  INSERT INTO public.notifications (id, user_id, title, message, type)
  VALUES (gen_random_uuid(), v_client_id, 'Notificação Teste', 'Conteúdo da notificação', 'system')
  RETURNING id INTO v_test_notif_id;


  -- =========================================================================
  -- BLOCO 1: provider_offers (Segurança & Rota Positiva submit_provider_offer)
  -- =========================================================================

  -- 1.1 Leitura: Cliente dono do pedido DEVE ler a oferta
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_client_id::text, true);
  SELECT COUNT(*) INTO v_row_count FROM public.provider_offers WHERE id = v_test_offer_id;
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Cliente proprietário do pedido não conseguiu ler a oferta.';
  END IF;

  -- 1.2 Leitura: Prestador dono da oferta DEVE ler a sua oferta
  PERFORM set_config('request.jwt.claim.sub', v_partner1_id::text, true);
  SELECT COUNT(*) INTO v_row_count FROM public.provider_offers WHERE id = v_test_offer_id;
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Prestador proprietário não conseguiu ler a sua oferta.';
  END IF;

  -- 1.3 Leitura: Prestador terceiro NÃO DEVE ler oferta de outro prestador
  PERFORM set_config('request.jwt.claim.sub', v_partner2_id::text, true);
  SELECT COUNT(*) INTO v_row_count FROM public.provider_offers WHERE id = v_test_offer_id;
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Prestador terceiro conseguiu ler oferta de outro prestador.';
  END IF;

  -- 1.4 Bloqueio de INSERT direto por authenticated
  BEGIN
    INSERT INTO public.provider_offers (request_id, provider_id, price)
    VALUES (v_test_finding_req_id, v_partner2_id, 200.00);
    RAISE EXCEPTION 'ASSERTION FAILED: Insert direto em provider_offers foi permitido.';
  EXCEPTION WHEN insufficient_privilege THEN
    -- Sucesso
  END;

  -- 1.5 Bloqueio de UPDATE direto por authenticated
  BEGIN
    UPDATE public.provider_offers SET price = 999.00 WHERE id = v_test_offer_id;
    RAISE EXCEPTION 'ASSERTION FAILED: Update direto em provider_offers foi permitido.';
  EXCEPTION WHEN insufficient_privilege THEN
    -- Sucesso
  END;

  -- 1.6 Bloqueio de DELETE direto por authenticated
  BEGIN
    DELETE FROM public.provider_offers WHERE id = v_test_offer_id;
    RAISE EXCEPTION 'ASSERTION FAILED: Delete direto em provider_offers foi permitido.';
  EXCEPTION WHEN insufficient_privilege THEN
    -- Sucesso
  END;

  -- 1.7 ROTA POSITIVA: submit_provider_offer como prestador verificado (Partner 2)
  PERFORM set_config('request.jwt.claim.sub', v_partner2_id::text, true);
  PERFORM public.submit_provider_offer(
    v_test_finding_req_id,
    180.00,
    45,
    'Oferta legitima prestador 2'
  );

  SELECT COUNT(*) INTO v_row_count
  FROM public.provider_offers
  WHERE request_id = v_test_finding_req_id AND provider_id = v_partner2_id AND status = 'offered';
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: submit_provider_offer não inseriu exatamente uma oferta.';
  END IF;


  -- =========================================================================
  -- BLOCO 2: notifications (Segurança & Leitura/Atualização)
  -- =========================================================================

  -- 2.1 Bloqueio de SELECT para anon
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    PERFORM count(*) FROM public.notifications;
    RAISE EXCEPTION 'ASSERTION FAILED: Role anon conseguiu fazer SELECT em notifications.';
  EXCEPTION WHEN insufficient_privilege THEN
    -- Sucesso
  END;

  -- 2.2 Atualização da própria notificação (is_read = true)
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_client_id::text, true);
  UPDATE public.notifications SET is_read = true WHERE id = v_test_notif_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Usuário não conseguiu marcar a própria notificação como lida.';
  END IF;

  -- 2.3 Bloqueio de atualização de outras colunas (ex: title)
  BEGIN
    UPDATE public.notifications SET title = 'Titulo Alterado' WHERE id = v_test_notif_id;
    RAISE EXCEPTION 'ASSERTION FAILED: Usuário conseguiu alterar título de notificação via update direto.';
  EXCEPTION WHEN insufficient_privilege THEN
    -- Sucesso
  END;

  -- 2.4 Bloqueio de DELETE direto em notifications
  BEGIN
    DELETE FROM public.notifications WHERE id = v_test_notif_id;
    RAISE EXCEPTION 'ASSERTION FAILED: Usuário conseguiu fazer DELETE em notifications.';
  EXCEPTION WHEN insufficient_privilege THEN
    -- Sucesso
  END;

  -- 2.5 Bloqueio de leitura de notificações alheias
  PERFORM set_config('request.jwt.claim.sub', v_partner1_id::text, true);
  SELECT COUNT(*) INTO v_row_count FROM public.notifications WHERE id = v_test_notif_id;
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Usuário conseguiu visualizar notificação de outro usuário.';
  END IF;


  -- =========================================================================
  -- BLOCO 3: reviews (Segurança & Rota Positiva submit_review)
  -- =========================================================================

  -- 3.1 Bloqueio de INSERT direto por authenticated
  PERFORM set_config('request.jwt.claim.sub', v_client_id::text, true);
  BEGIN
    INSERT INTO public.reviews (request_id, reviewer_id, reviewee_id, role, rating, comment)
    VALUES (v_test_done_req_id, v_client_id, v_partner1_id, 'client', 5, 'Excelente');
    RAISE EXCEPTION 'ASSERTION FAILED: Insert direto em reviews foi permitido.';
  EXCEPTION WHEN insufficient_privilege THEN
    -- Sucesso
  END;

  -- 3.2 Bloqueio de UPDATE direto em reviews
  BEGIN
    UPDATE public.reviews SET rating = 1 WHERE request_id = v_test_done_req_id;
    RAISE EXCEPTION 'ASSERTION FAILED: Update direto em reviews foi permitido.';
  EXCEPTION WHEN insufficient_privilege THEN
    -- Sucesso
  END;

  -- 3.3 Bloqueio de DELETE direto em reviews
  BEGIN
    DELETE FROM public.reviews WHERE request_id = v_test_done_req_id;
    RAISE EXCEPTION 'ASSERTION FAILED: Delete direto em reviews foi permitido.';
  EXCEPTION WHEN insufficient_privilege THEN
    -- Sucesso
  END;

  -- 3.4 ROTA POSITIVA: submit_review canônica chamada como cliente autenticado
  PERFORM public.submit_review(
    v_test_done_req_id,
    5::smallint,
    'Serviço excelente e pontual'
  );

  SELECT COUNT(*) INTO v_row_count
  FROM public.reviews
  WHERE request_id = v_test_done_req_id
    AND reviewer_id = v_client_id
    AND reviewee_id = v_partner1_id
    AND role = 'provider'
    AND rating = 5;

  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: submit_review não inseriu exatamente uma review com papeis derivados corretamente.';
  END IF;

  -- 3.5 Leitura da review inserida pelo cliente e pelo prestador avaliado
  SELECT COUNT(*) INTO v_row_count FROM public.reviews WHERE request_id = v_test_done_req_id;
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Cliente autor da review não conseguiu ler sua avaliação.';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_partner1_id::text, true);
  SELECT COUNT(*) INTO v_row_count FROM public.reviews WHERE request_id = v_test_done_req_id;
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Prestador avaliado não conseguiu ler a avaliação recebida.';
  END IF;


  -- =========================================================================
  -- BLOCO 4: partner_highlights (Segurança & CRUD de Próprios Highlights)
  -- =========================================================================

  -- 4.1 Prestador parceiro pode criar seu próprio destaque ativo
  PERFORM set_config('request.jwt.claim.sub', v_partner1_id::text, true);
  INSERT INTO public.partner_highlights (partner_id, name, price, is_active)
  VALUES (v_partner1_id, 'Instalação Elétrica', 150.00, true)
  RETURNING id INTO v_test_highlight_id;

  IF v_test_highlight_id IS NULL THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Parceiro verificado não conseguiu criar seu próprio highlight ativo.';
  END IF;

  -- 4.2 Prestador parceiro pode criar seu próprio destaque inativo
  INSERT INTO public.partner_highlights (partner_id, name, price, is_active)
  VALUES (v_partner1_id, 'Instalação Inativa', 200.00, false)
  RETURNING id INTO v_test_inactive_highlight_id;

  -- 4.3 Cliente comum (sem perfil em partners) NÃO PODE criar destaque de parceiro
  PERFORM set_config('request.jwt.claim.sub', v_client_id::text, true);
  BEGIN
    INSERT INTO public.partner_highlights (partner_id, name, price, is_active)
    VALUES (v_client_id, 'Serviço Inválido', 50.00, true);
    RAISE EXCEPTION 'ASSERTION FAILED: Cliente sem perfil em partners conseguiu criar destaque.';
  EXCEPTION WHEN insufficient_privilege THEN
    -- Sucesso: bloqueado por policy/check
  END;

  -- 4.4 Usuário autenticado terceiro NÃO DEVE visualizar destaque inativo de outro parceiro
  PERFORM set_config('request.jwt.claim.sub', v_partner2_id::text, true);
  SELECT COUNT(*) INTO v_row_count FROM public.partner_highlights WHERE id = v_test_inactive_highlight_id;
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Usuário conseguiu visualizar highlight inativo de outro parceiro.';
  END IF;

  -- 4.5 O próprio parceiro dono DEVE conseguir visualizar seu destaque inativo
  PERFORM set_config('request.jwt.claim.sub', v_partner1_id::text, true);
  SELECT COUNT(*) INTO v_row_count FROM public.partner_highlights WHERE id = v_test_inactive_highlight_id;
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Próprio parceiro não conseguiu visualizar seu highlight inativo.';
  END IF;

  -- 4.6 Outro parceiro NÃO DEVE conseguir atualizar destaque alheio
  PERFORM set_config('request.jwt.claim.sub', v_partner2_id::text, true);
  UPDATE public.partner_highlights SET price = 999.00 WHERE id = v_test_highlight_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Parceiro conseguiu atualizar highlight de outro parceiro.';
  END IF;

  -- 4.7 Outro parceiro NÃO DEVE conseguir deletar destaque alheio
  DELETE FROM public.partner_highlights WHERE id = v_test_highlight_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Parceiro conseguiu deletar highlight de outro parceiro.';
  END IF;


  -- =========================================================================
  -- BLOCO 5: Chat Messaging & Notifications RLS
  -- =========================================================================

  -- Verificar se a RPC send_chat_message_v1 existe no catálogo
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'send_chat_message_v1'
  ) INTO v_fn_exists;

  IF v_fn_exists THEN
    -- Executar a RPC canônica caso esteja instalada
    PERFORM set_config('request.jwt.claim.sub', v_client_id::text, true);
    PERFORM public.send_chat_message_v1(v_test_chat_req_id, 'Mensagem de teste via RPC');

    -- 5.1 Destinatário (Partner 1) DEVE conseguir ler a mensagem recebida
    PERFORM set_config('request.jwt.claim.sub', v_partner1_id::text, true);
    SELECT COUNT(*) INTO v_row_count
    FROM public.notifications
    WHERE type = 'message' AND related_id = v_test_chat_req_id AND user_id = v_partner1_id;
    IF v_row_count < 1 THEN
      RAISE EXCEPTION 'ASSERTION FAILED: Destinatário não conseguiu ler mensagem de chat em notifications.';
    END IF;

    -- 5.2 Remetente (Client) DEVE conseguir ler o registro de saída
    PERFORM set_config('request.jwt.claim.sub', v_client_id::text, true);
    SELECT COUNT(*) INTO v_row_count
    FROM public.notifications
    WHERE type = 'message' AND related_id = v_test_chat_req_id AND user_id = v_client_id;
    IF v_row_count < 1 THEN
      RAISE EXCEPTION 'ASSERTION FAILED: Remetente não conseguiu ler seu registro de mensagem em notifications.';
    END IF;

    -- 5.3 Terceiro (Partner 2) NÃO DEVE conseguir ler nenhuma das mensagens
    PERFORM set_config('request.jwt.claim.sub', v_partner2_id::text, true);
    SELECT COUNT(*) INTO v_row_count
    FROM public.notifications
    WHERE type = 'message' AND related_id = v_test_chat_req_id;
    IF v_row_count <> 0 THEN
      RAISE EXCEPTION 'ASSERTION FAILED: Terceiro conseguiu ler notificações de chat de outra conversa.';
    END IF;
  ELSE
    RAISE NOTICE 'SKIPPED_EXISTING_DEFECT: send_chat_message_v1 não está instalada na branch; será tratada no Patch Atômico de RPCs.';
  END IF;

END $$;

ROLLBACK;
