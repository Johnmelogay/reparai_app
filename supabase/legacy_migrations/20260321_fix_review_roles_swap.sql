-- Migration: Swap review roles to match new semantics
-- The role field should indicate the reviewee's role, not the reviewer's role.

UPDATE public.reviews
SET role = CASE 
    WHEN role = 'client' THEN 'provider'
    WHEN role = 'provider' THEN 'client'
    ELSE role
END;
