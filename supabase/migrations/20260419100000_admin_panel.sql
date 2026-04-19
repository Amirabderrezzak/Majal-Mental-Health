-- ============================================================
-- Admin Panel Migration (Safe to re-run)
-- ============================================================

-- 1. Add is_admin flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. Add approval_status for therapists
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';

-- Add constraint only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_approval_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- 3. Update handle_new_user so new therapists start as 'pending'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_type TEXT;
  v_approval  TEXT;
BEGIN
  v_user_type := COALESCE(NEW.raw_user_meta_data->>'user_type', 'patient');
  IF v_user_type = 'psychologue' THEN
    v_approval := 'pending';
  ELSE
    v_approval := 'approved';
  END IF;

  INSERT INTO public.profiles (
    user_id, full_name, phone, user_type,
    order_number, specialty, city, approval_status
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_user_type,
    NEW.raw_user_meta_data->>'order_number',
    NEW.raw_user_meta_data->>'specialty',
    NEW.raw_user_meta_data->>'city',
    v_approval
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 4. Recreate policies safely (drop first, then create)
DROP POLICY IF EXISTS "Anyone can view psychologist profiles"          ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view approved psychologist profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles"                   ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile"                  ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all bookings"                   ON public.bookings;
DROP POLICY IF EXISTS "Admins can update any booking"                  ON public.bookings;
DROP POLICY IF EXISTS "Admins can delete any review"                   ON public.reviews;

-- Only APPROVED psychologists appear in public listings
CREATE POLICY "Anyone can view approved psychologist profiles"
  ON public.profiles FOR SELECT
  USING (
    (user_type = 'psychologue' AND approval_status = 'approved')
    OR auth.uid() = user_id
  );

-- Admins can read ALL profiles
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  );

-- Admins can update any profile (approve therapists, grant admin)
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  );

-- Admins can read ALL bookings
CREATE POLICY "Admins can read all bookings"
  ON public.bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  );

-- Admins can update any booking
CREATE POLICY "Admins can update any booking"
  ON public.bookings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  );

-- Admins can delete inappropriate reviews
CREATE POLICY "Admins can delete any review"
  ON public.reviews FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  );

-- ============================================================
-- FINAL STEP: Make yourself an admin
-- Replace YOUR_EMAIL with your Majal account email and run:
--
-- UPDATE public.profiles
-- SET is_admin = true
-- WHERE user_id = (
--   SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL'
-- );
-- ============================================================
