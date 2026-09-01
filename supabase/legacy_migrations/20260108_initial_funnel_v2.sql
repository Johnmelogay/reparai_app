-- 1. Create 'requests' table
CREATE TABLE IF NOT EXISTS public.requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    category TEXT NOT NULL,
    user_text TEXT,
    answers_json JSONB DEFAULT '{}',
    ai_result_json JSONB DEFAULT '{}',
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    address TEXT,
    status TEXT DEFAULT 'draft',
    provider_id UUID REFERENCES partners(id),
    displacement_fee NUMERIC(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create 'base_questions' table
CREATE TABLE IF NOT EXISTS public.base_questions (
    id TEXT PRIMARY KEY,
    question_text TEXT NOT NULL,
    question_order INT NOT NULL,
    response_type TEXT DEFAULT 'tri',
    category TEXT DEFAULT 'universal'
);

-- Seed base questions
INSERT INTO public.base_questions (id, question_text, question_order, response_type, category)
VALUES
    ('q1_item', 'Qual item/equipamento precisa de reparo?', 1, 'select', 'universal'),
    ('q2_stopped', 'O equipamento está totalmente parado?', 2, 'tri', 'universal'),
    ('q3_urgent', 'Existe risco ou urgência agora? (vazamento, fumaça, curto)', 3, 'tri', 'universal')
ON CONFLICT (id) DO NOTHING;

-- 3. Create 'item_options' table
CREATE TABLE IF NOT EXISTS public.item_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    icon TEXT
);

-- Seed HVAC options
INSERT INTO public.item_options (category, label, value)
VALUES
    ('hvac', 'Split', 'split'),
    ('hvac', 'Janela', 'window'),
    ('hvac', 'Portátil', 'portable'),
    ('hvac', 'Não sei', 'unknown')
ON CONFLICT DO NOTHING; -- No natural key, likely won't conflict unless unique constraint added, good for now.

-- 4. Create RPC 'find_nearby_providers'
CREATE OR REPLACE FUNCTION public.find_nearby_providers(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    category_filter TEXT,
    radius_km INT DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    full_name TEXT,
    avatar_url TEXT,
    rating NUMERIC,
    base_fee NUMERIC,
    distance_km DOUBLE PRECISION,
    is_online BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        pr.full_name,
        pr.avatar_url,
        p.rating,
        p.base_fee,
        ST_Distance(
            p.location::geography,
            ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
        ) / 1000 as distance_km,
        p.is_online
    FROM partners p
    JOIN profiles pr ON p.id = pr.id
    WHERE p.service_category = category_filter
      AND p.is_online = true
      AND ST_DWithin(
          p.location::geography,
          ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
          radius_km * 1000
      )
    ORDER BY p.rating DESC, distance_km ASC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;
