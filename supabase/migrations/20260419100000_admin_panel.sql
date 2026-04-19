-- ============================================================
-- Admin Panel Migration
-- ============================================================

-- 1. Add is_admin flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. Add approval_status for therapists
--    pending = awaiting admin review
--    approved = visible on the platform
--    rejected = blocked from listing
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- All new psychologue registrations start as pending
-- We handle this logic in the handle_new_user trigger
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
  -- Therapists require admin approval before going live
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

-- 3. Update the public listing policy so only APPROVED psychologists are visible
DROP POLICY IF EXISTS "Anyone can view psychologist profiles" ON public.profiles;

CREATE POLICY "Anyone can view approved psychologist profiles"
  ON public.profiles FOR SELECT
  USING (
    (user_type = 'psychologue' AND approval_status = 'approved')
    OR auth.uid() = user_id
  );

-- 4. Admin RLS: Admins can read ALL profiles (for the admin panel)
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  );

-- 5. Admins can update any profile (to approve therapists, grant admin, etc.)
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  );

-- 6. Admins can read ALL bookings
CREATE POLICY "Admins can read all bookings"
  ON public.bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  );

-- 7. Admins can update any booking (for dispute resolution)
CREATE POLICY "Admins can update any booking"
  ON public.bookings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  );

-- 8. Admins can delete inappropriate reviews
CREATE POLICY "Admins can delete any review"
  ON public.reviews FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  );

-- ============================================================
-- HOW TO MAKE YOURSELF AN ADMIN
-- After running this migration, run the following command
-- replacing YOUR_EMAIL with your actual account email:
--
-- UPDATE public.profiles
-- SET is_admin = true
-- WHERE user_id = (
--   SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL'
-- );
-- ============================================================
