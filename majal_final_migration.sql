CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  language TEXT DEFAULT 'fr',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- Add user_type to profiles
ALTER TABLE public.profiles ADD COLUMN user_type text NOT NULL DEFAULT 'patient';

-- Add psychologist-specific fields
ALTER TABLE public.profiles ADD COLUMN order_number text;
ALTER TABLE public.profiles ADD COLUMN specialty text;
ALTER TABLE public.profiles ADD COLUMN city text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone, user_type, order_number, specialty, city)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'patient'),
    NEW.raw_user_meta_data->>'order_number',
    NEW.raw_user_meta_data->>'specialty',
    NEW.raw_user_meta_data->>'city'
  );
  RETURN NEW;
END;
$$;

-- ============================================================
-- Bookings table
-- ============================================================
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  psychologist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booked_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'done')),
  price INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Patients can view their own bookings
CREATE POLICY "Patients can view own bookings"
  ON public.bookings FOR SELECT
  USING (auth.uid() = patient_id);

-- Patients can create bookings
CREATE POLICY "Patients can create bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

-- Patients can cancel their own pending bookings
CREATE POLICY "Patients can cancel own bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = patient_id AND status = 'pending');

-- Psychologists can view bookings assigned to them
CREATE POLICY "Psychologists can view their bookings"
  ON public.bookings FOR SELECT
  USING (auth.uid() = psychologist_id);

-- Psychologists can confirm/complete/cancel bookings assigned to them
CREATE POLICY "Psychologists can update their bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = psychologist_id);

-- Auto-update updated_at
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Reviews table
-- ============================================================
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  psychologist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews (public listing on psychologist profiles)
CREATE POLICY "Reviews are publicly readable"
  ON public.reviews FOR SELECT
  USING (true);

-- Only patients can write a review, and only once per booking
CREATE POLICY "Patients can create one review per booking"
  ON public.reviews FOR INSERT
  WITH CHECK (
    auth.uid() = patient_id AND
    NOT EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.booking_id = reviews.booking_id AND r.patient_id = auth.uid()
    )
  );

-- Patients can update their own reviews
CREATE POLICY "Patients can update own reviews"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = patient_id);

-- Patients can delete their own reviews
CREATE POLICY "Patients can delete own reviews"
  ON public.reviews FOR DELETE
  USING (auth.uid() = patient_id);

-- Computed average rating view for psychologist profiles
CREATE OR REPLACE VIEW public.psychologist_ratings AS
  SELECT
    psychologist_id,
    ROUND(AVG(rating)::NUMERIC, 1) AS avg_rating,
    COUNT(*) AS review_count
  FROM public.reviews
  GROUP BY psychologist_id;

-- Add psychologist-specific profile enrichment fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS price_per_session INT,
  ADD COLUMN IF NOT EXISTS years_experience INT;

-- Allow public read access to psychologist profiles (for the listing page)
CREATE POLICY "Anyone can view psychologist profiles"
  ON public.profiles FOR SELECT
  USING (user_type = 'psychologue' OR auth.uid() = user_id);
