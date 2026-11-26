-- ============================================================================
-- Reschedule requests: a patient proposes a time OUTSIDE the therapist's normal
-- availability (evening, weekend, outside working hours…) and the therapist
-- accepts or declines. The booking only moves once accepted.
--
-- All writes go through api/bookings.ts (service role), which validates the
-- booking, the proposed time and overlaps. Clients can only read their own rows.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reschedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  psychologist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Where the booking was when the request was made (to detect stale requests).
  original_booked_at TIMESTAMPTZ NOT NULL,
  proposed_at TIMESTAMPTZ NOT NULL,
  message TEXT CHECK (message IS NULL OR char_length(message) <= 500),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  response_note TEXT CHECK (response_note IS NULL OR char_length(response_note) <= 500),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One open request per session.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reschedule_requests_one_pending
  ON public.reschedule_requests (booking_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reschedule_requests_psy_pending
  ON public.reschedule_requests (psychologist_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reschedule_requests_patient
  ON public.reschedule_requests (patient_id);

ALTER TABLE public.reschedule_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants read their reschedule requests" ON public.reschedule_requests;
CREATE POLICY "Participants read their reschedule requests" ON public.reschedule_requests
  FOR SELECT USING (auth.uid() = patient_id OR auth.uid() = psychologist_id OR public.is_admin());

-- No INSERT/UPDATE/DELETE policies: only the API (service role) writes.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.reschedule_requests FROM anon, authenticated;

-- Live updates in both spaces.
ALTER TABLE public.reschedule_requests REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'reschedule_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reschedule_requests;
  END IF;
END $$;
