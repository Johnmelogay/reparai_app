-- Test Suite: test_restore_provider_location_rpc.sql
-- Description: Validação de segurança e limites de coordenadas para a RPC set_my_partner_location
-- Nota: Executa dentro de transação com ROLLBACK no final para garantir ausência de efeitos colaterais.

BEGIN;

DO $$
DECLARE
  v_partner1_id uuid;
  v_partner2_id uuid;
  v_client_id uuid;
  v_initial_partner_count integer;
  v_final_partner_count integer;
  v_partner2_loc_before geography;
  v_partner2_loc_after geography;
  v_partner1_online_before boolean;
  v_partner1_online_after boolean;
  v_partner1_updated_at_before timestamptz;
  v_partner1_updated_at_after timestamptz;
  v_lat double precision;
  v_lng double precision;
BEGIN
  -- 1. Obter contas reais existentes no banco de teste
  SELECT id INTO v_partner1_id FROM public.partners ORDER BY id LIMIT 1;
  SELECT id INTO v_partner2_id FROM public.partners WHERE id <> v_partner1_id ORDER BY id LIMIT 1;
  SELECT id INTO v_client_id FROM public.clients WHERE id NOT IN (SELECT id FROM public.partners) ORDER BY id LIMIT 1;

  IF v_partner1_id IS NULL OR v_partner2_id IS NULL OR v_client_id IS NULL THEN
    RAISE EXCEPTION 'SETUP FAILED: Contas de teste insuficientes em public.partners / public.clients.';
  END IF;

  SELECT count(*) INTO v_initial_partner_count FROM public.partners;
  SELECT location INTO v_partner2_loc_before FROM public.partners WHERE id = v_partner2_id;
  SELECT is_online, updated_at INTO v_partner1_online_before, v_partner1_updated_at_before FROM public.partners WHERE id = v_partner1_id;


  -- =========================================================================
  -- TESTE 1: Bloqueio para role anon
  -- =========================================================================
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    PERFORM public.set_my_partner_location(
      input_lat := -8.7496,
      input_long := -63.8451
    );
    RAISE EXCEPTION 'ASSERTION FAILED: Role anon conseguiu executar set_my_partner_location.';
  EXCEPTION WHEN insufficient_privilege THEN
    -- Sucesso: permissão negada
  END;


  -- =========================================================================
  -- TESTE 2: Usuário autenticado sem perfil de prestador
  -- =========================================================================
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_client_id::text, true);
  BEGIN
    PERFORM public.set_my_partner_location(
      input_lat := -8.7496,
      input_long := -63.8451
    );
    RAISE EXCEPTION 'ASSERTION FAILED: Cliente sem perfil em partners não gerou provider_profile_not_found.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%provider_profile_not_found%' THEN
      RAISE EXCEPTION 'ASSERTION FAILED: Erro inesperado para cliente sem partners: %', SQLERRM;
    END IF;
  END;


  -- =========================================================================
  -- TESTE 3: Prestador existente salva coordenadas válidas
  -- =========================================================================
  PERFORM set_config('request.jwt.claim.sub', v_partner1_id::text, true);
  PERFORM public.set_my_partner_location(
    input_lat := -8.7496,
    input_long := -63.8451
  );

  SELECT
    ST_Y(location::geometry),
    ST_X(location::geometry),
    is_online,
    updated_at
  INTO
    v_lat,
    v_lng,
    v_partner1_online_after,
    v_partner1_updated_at_after
  FROM public.partners
  WHERE id = v_partner1_id;

  IF ROUND(v_lat::numeric, 4) <> -8.7496 OR ROUND(v_lng::numeric, 4) <> -63.8451 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Coordenadas salvas incorretamente: lat=%, lng=%', v_lat, v_lng;
  END IF;

  -- 3.1 is_online não deve ter sido alterado
  IF v_partner1_online_after IS DISTINCT FROM v_partner1_online_before THEN
    RAISE EXCEPTION 'ASSERTION FAILED: is_online foi modificado pela RPC de localização.';
  END IF;

  -- 3.2 updated_at deve ter sido atualizado
  IF v_partner1_updated_at_after <= v_partner1_updated_at_before THEN
    RAISE EXCEPTION 'ASSERTION FAILED: updated_at não foi atualizado.';
  END IF;


  -- =========================================================================
  -- TESTE 4: Validação de limites (Latitude > 90 e < -90)
  -- =========================================================================
  BEGIN
    PERFORM public.set_my_partner_location(
      input_lat := 90.0001,
      input_long := -63.8451
    );
    RAISE EXCEPTION 'ASSERTION FAILED: Latitude > 90 foi aceita.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%invalid_coordinates%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.set_my_partner_location(
      input_lat := -90.0001,
      input_long := -63.8451
    );
    RAISE EXCEPTION 'ASSERTION FAILED: Latitude < -90 foi aceita.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%invalid_coordinates%' THEN RAISE; END IF;
  END;


  -- =========================================================================
  -- TESTE 5: Validação de limites (Longitude > 180 e < -180)
  -- =========================================================================
  BEGIN
    PERFORM public.set_my_partner_location(
      input_lat := -8.7496,
      input_long := 180.0001
    );
    RAISE EXCEPTION 'ASSERTION FAILED: Longitude > 180 foi aceita.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%invalid_coordinates%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.set_my_partner_location(
      input_lat := -8.7496,
      input_long := -180.0001
    );
    RAISE EXCEPTION 'ASSERTION FAILED: Longitude < -180 foi aceita.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%invalid_coordinates%' THEN RAISE; END IF;
  END;


  -- =========================================================================
  -- TESTE 6: Rejeição de NULL
  -- =========================================================================
  BEGIN
    PERFORM public.set_my_partner_location(
      input_lat := NULL,
      input_long := -63.8451
    );
    RAISE EXCEPTION 'ASSERTION FAILED: Latitude NULL foi aceita.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%invalid_coordinates%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.set_my_partner_location(
      input_lat := -8.7496,
      input_long := NULL
    );
    RAISE EXCEPTION 'ASSERTION FAILED: Longitude NULL foi aceita.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%invalid_coordinates%' THEN RAISE; END IF;
  END;


  -- =========================================================================
  -- TESTE 7: Rejeição de NaN e Infinity
  -- =========================================================================
  BEGIN
    PERFORM public.set_my_partner_location(
      input_lat := 'NaN'::double precision,
      input_long := -63.8451
    );
    RAISE EXCEPTION 'ASSERTION FAILED: Latitude NaN foi aceita.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%invalid_coordinates%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.set_my_partner_location(
      input_lat := -8.7496,
      input_long := 'Infinity'::double precision
    );
    RAISE EXCEPTION 'ASSERTION FAILED: Longitude Infinity foi aceita.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%invalid_coordinates%' THEN RAISE; END IF;
  END;


  -- =========================================================================
  -- TESTE 8: Isolamento de linhas e integridade da tabela
  -- =========================================================================
  -- 8.1 Verificar que a localização do Partner 2 permaneceu inalterada
  SELECT location INTO v_partner2_loc_after FROM public.partners WHERE id = v_partner2_id;
  IF v_partner2_loc_after IS DISTINCT FROM v_partner2_loc_before THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Localização de outro prestador foi afetada.';
  END IF;

  -- 8.2 Verificar que nenhum registro novo foi criado
  SELECT count(*) INTO v_final_partner_count FROM public.partners;
  IF v_final_partner_count <> v_initial_partner_count THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Contagem de parceiros foi alterada (houve insert/upsert).';
  END IF;

END $$;

ROLLBACK;
