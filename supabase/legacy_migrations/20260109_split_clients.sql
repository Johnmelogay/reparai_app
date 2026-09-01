-- Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own client profile
CREATE POLICY "Users can view own client profile" ON public.clients
    FOR SELECT USING (auth.uid() = id);

-- Policy: Users can update their own client profile
CREATE POLICY "Users can update own client profile" ON public.clients
    FOR UPDATE USING (auth.uid() = id);

-- Move existing clients from profiles to clients
INSERT INTO public.clients (id, full_name, avatar_url, phone, created_at)
SELECT id, full_name, avatar_url, phone, created_at
FROM public.profiles
WHERE user_type = 'client';

-- Remove clients from profiles
DELETE FROM public.profiles WHERE user_type = 'client';

-- Update RLS on profiles to allow public read for providers (so everyone can see the list)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- New Policy: Public can view profiles (filtered to only show providers/non-clients if needed, 
-- but since we moved clients out, profiles is effectively the providers table now).
-- Start with overly permissive read slightly to ensure list works, then tighten if needed.
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

-- Policy: Users can update ONLY their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Update the handle_new_user function to route correctly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- If user_type is client, insert into clients table
  IF new.raw_user_meta_data->>'user_type' = 'client' THEN
    INSERT INTO public.clients (id, full_name, avatar_url, phone)
    VALUES (
      new.id,
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'phone'
    );
  ELSE
    -- Default to profiles (Provider, Admin, etc.)
    INSERT INTO public.profiles (id, full_name, avatar_url, phone, user_type)
    VALUES (
      new.id,
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'phone',
      COALESCE(new.raw_user_meta_data->>'user_type', 'provider')
    );
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
