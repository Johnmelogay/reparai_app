-- 1. Limpar dados anteriores (opcional, para garantir idents)
-- delete from partners;
-- delete from profiles where user_type = 'partner';

-- Helper para gerar UUIDs se não existir
create extension if not exists "uuid-ossp";

-- ==========================================
-- 10 OFICINAS REAIS (Porto Velho)
-- ==========================================

-- Oficina 1: Mecânica Passarinho (São Cristóvão)
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, 'Mecânica Passarinho', 'partner', 'https://ui-avatars.com/api/?name=MP&background=ff7b00&color=fff');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'auto', 4.8, 80.00, 3.00, true, ST_SetSRID(ST_MakePoint(-63.8950, -8.7550), 4326)); -- Approx Location
END $$;

-- Oficina 2: Vitaru Auto Service
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, 'Vitaru Auto Service', 'partner', 'https://ui-avatars.com/api/?name=VS&background=ff7b00&color=fff');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'auto', 5.0, 90.00, 3.50, true, ST_SetSRID(ST_MakePoint(-63.8817, -8.7490), 4326));
END $$;

-- Oficina 3: 24 Horas Centro Automotivo
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, '24 Horas Centro Automotivo', 'partner', 'https://ui-avatars.com/api/?name=24H&background=000&color=fff');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'auto', 4.2, 120.00, 5.00, true, ST_SetSRID(ST_MakePoint(-63.8760, -8.7619), 4326));
END $$;

-- Oficina 4: RR Auto Center
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, 'RR Auto Center', 'partner', 'https://ui-avatars.com/api/?name=RR&background=ff0000&color=fff');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'auto', 4.5, 70.00, 2.50, true, ST_SetSRID(ST_MakePoint(-63.9050, -8.7700), 4326));
END $$;

-- Oficina 5: Ello Centro Automotivo
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, 'Ello Centro Automotivo', 'partner', 'https://ui-avatars.com/api/?name=Ello&background=333&color=fff');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'auto', 4.7, 60.00, 2.00, true, ST_SetSRID(ST_MakePoint(-63.8990, -8.7650), 4326));
END $$;

-- Oficina 6: ONOFRE CAR
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, 'ONOFRE CAR', 'partner', 'https://ui-avatars.com/api/?name=OC&background=00f&color=fff');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'auto', 4.9, 100.00, 4.00, true, ST_SetSRID(ST_MakePoint(-63.8850, -8.7500), 4326));
END $$;

-- Oficina 7: Auto Service Oficina
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, 'Auto Service Oficina', 'partner', 'https://ui-avatars.com/api/?name=AS&background=777&color=fff');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'auto', 4.6, 75.00, 2.80, true, ST_SetSRID(ST_MakePoint(-63.8910, -8.7680), 4326));
END $$;

-- Oficina 8: ADEMIR AUTO CENTER
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, 'ADEMIR AUTO CENTER', 'partner', 'https://ui-avatars.com/api/?name=Ace&background=aaa&color=000');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'auto', 4.3, 65.00, 2.20, true, ST_SetSRID(ST_MakePoint(-63.9080, -8.7550), 4326));
END $$;

-- Oficina 9: Skap-Car
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, 'Skap-Car Centro Automotivo', 'partner', 'https://ui-avatars.com/api/?name=SC&background=550&color=fff');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'auto', 4.8, 85.00, 3.20, true, ST_SetSRID(ST_MakePoint(-63.8920, -8.7450), 4326));
END $$;

-- Oficina 10: Amazon Pneus
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, 'Amazon Pneus', 'partner', 'https://ui-avatars.com/api/?name=AP&background=228&color=fff');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'auto', 4.5, 50.00, 2.00, true, ST_SetSRID(ST_MakePoint(-63.9005, -8.7605), 4326));
END $$;


-- ==========================================
-- 10 PRESTADORES FICTÍCIOS (Diversos)
-- ==========================================

-- 11. João Eletricista
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, 'João Silva Eletrica', 'partner', 'https://randomuser.me/api/portraits/men/1.jpg');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'electronics', 4.9, 40.00, 1.50, true, ST_SetSRID(ST_MakePoint(-63.9100, -8.7600), 4326));
END $$;

-- 12. Maria Limpezas
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, 'Maria Limpezas Express', 'partner', 'https://randomuser.me/api/portraits/women/2.jpg');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'cleaning', 4.8, 120.00, 2.00, true, ST_SetSRID(ST_MakePoint(-63.9020, -8.7520), 4326));
END $$;

-- 13. Pedro Encanador
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, 'Pedro Encanador 24h', 'partner', 'https://randomuser.me/api/portraits/men/3.jpg');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'plumbing', 4.7, 60.00, 1.80, true, ST_SetSRID(ST_MakePoint(-63.8960, -8.7580), 4326));
END $$;

-- 14. Ana Manicure
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, 'Ana Beauty Home', 'partner', 'https://randomuser.me/api/portraits/women/4.jpg');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'beauty', 5.0, 30.00, 1.00, true, ST_SetSRID(ST_MakePoint(-63.8880, -8.7630), 4326));
END $$;

-- 15. Carlos Ar Condicionado
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, 'Carlos Climatização', 'partner', 'https://randomuser.me/api/portraits/men/5.jpg');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'hvac', 4.6, 90.00, 2.50, true, ST_SetSRID(ST_MakePoint(-63.9040, -8.7480), 4326));
END $$;

-- 16. Julia Jardineira
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, 'Julia Paisagismo', 'partner', 'https://randomuser.me/api/portraits/women/6.jpg');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'gardening', 4.8, 150.00, 3.00, true, ST_SetSRID(ST_MakePoint(-63.8900, -8.7540), 4326));
END $$;

-- 17. Tech Fix (Celulares)
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, 'Tech Fix Mobile', 'partner', 'https://randomuser.me/api/portraits/men/7.jpg');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'electronics', 4.5, 45.00, 1.20, true, ST_SetSRID(ST_MakePoint(-63.8980, -8.7660), 4326));
END $$;

-- 18. Marcenaria Express
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, 'José Marceneiro', 'partner', 'https://randomuser.me/api/portraits/men/8.jpg');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'carpentry', 4.9, 200.00, 4.00, true, ST_SetSRID(ST_MakePoint(-63.8840, -8.7590), 4326));
END $$;

-- 19. Dedetizadora Velho
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, 'Dedetizadora Velho', 'partner', 'https://ui-avatars.com/api/?name=DV&background=050&color=fff');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'pest_control', 4.4, 180.00, 2.50, true, ST_SetSRID(ST_MakePoint(-63.9060, -8.7440), 4326));
END $$;

-- 20. Faz-Tudo Roberto
DO $$
DECLARE new_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO profiles (id, full_name, user_type, avatar_url) VALUES (new_id, 'Roberto Marido de Aluguel', 'partner', 'https://randomuser.me/api/portraits/men/9.jpg');
  INSERT INTO partners (id, service_category, rating, base_fee, price_per_distance, is_online, location)
  VALUES (new_id, 'handyman', 4.7, 60.00, 2.00, true, ST_SetSRID(ST_MakePoint(-63.8930, -8.7620), 4326));
END $$;
