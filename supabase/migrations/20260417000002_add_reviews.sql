
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
