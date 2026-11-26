-- Reschedule requests can now come from either side. A therapist who can't make
-- a paid session proposes another time and the patient accepts with one click,
-- instead of cancelling and making the patient pay again for a new booking
-- (which is what happened in practice before this existed).
ALTER TABLE public.reschedule_requests
  ADD COLUMN IF NOT EXISTS initiated_by TEXT NOT NULL DEFAULT 'patient';
ALTER TABLE public.reschedule_requests DROP CONSTRAINT IF EXISTS reschedule_requests_initiated_by_check;
ALTER TABLE public.reschedule_requests ADD CONSTRAINT reschedule_requests_initiated_by_check
  CHECK (initiated_by IN ('patient', 'psychologist'));
