
-- Add user_type to profiles
ALTER TABLE public.profiles ADD COLUMN user_type text NOT NULL DEFAULT 'patient';

-- Add psychologist-specific fields
ALTER TABLE public.profiles ADD COLUMN order_number text;
ALTER TABLE public.profiles ADD COLUMN specialty text;
ALTER TABLE public.profiles ADD COLUMN city text;
