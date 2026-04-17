
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
