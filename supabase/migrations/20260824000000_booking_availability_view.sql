-- Public, PII-free availability view: which (psychologist, time) slots are taken.
-- Mirrors the psychologist_directory pattern (superuser-owned view that bypasses
-- base-table RLS), so the calendar can show slots already booked by ANY patient
-- without exposing patient PII (only psychologist_id + booked_at are exposed).
CREATE OR REPLACE VIEW public.psychologist_availability AS
SELECT
  psychologist_id,
  booked_at,
  status
FROM public.bookings
WHERE status <> 'cancelled';

GRANT SELECT ON public.psychologist_availability TO anon, authenticated;
