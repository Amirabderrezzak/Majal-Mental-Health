-- Persist the chosen session type (individual / couples / adolescents) so a
-- booking records what kind of session was booked, not just its price.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'individual'
  CHECK (session_type IN ('individual', 'couples', 'adolescents'));

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'individual'
  CHECK (session_type IN ('individual', 'couples', 'adolescents'));
