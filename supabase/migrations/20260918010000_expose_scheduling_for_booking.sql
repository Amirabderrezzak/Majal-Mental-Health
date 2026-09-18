-- Wires real psychologist availability into the booking UI (previously the
-- booking/reschedule flows showed a hardcoded generic slot list regardless
-- of clinic_settings). Two additions, both non-breaking (CREATE OR REPLACE
-- VIEW only appends columns, existing consumers are unaffected):
--
-- 1. `clinic_settings` (working hours/days/buffer/vacation mode — no PII) on
--    the public directory view, so the booking page can read a
--    psychologist's real schedule without needing a separate authenticated
--    query against the base `profiles` table.
-- 2. `duration_minutes` on the availability view, so slot-conflict checks
--    can exclude a booking's actual duration (+ buffer) instead of assuming
--    every booking is exactly 60 minutes.

-- DROP + CREATE (not CREATE OR REPLACE): adding a column changes the output
-- column set, which CREATE OR REPLACE VIEW does not allow here (same
-- constraint noted in 20260818010000, which established this view's current
-- shape). New column is appended at the end so nothing shifts.
DROP VIEW IF EXISTS public.psychologist_directory;

CREATE VIEW public.psychologist_directory AS
SELECT
  p.user_id,
  p.full_name,
  p.specialty,
  p.city,
  p.bio,
  p.price_per_session,
  p.price_individual,
  p.price_couples,
  p.price_adolescents,
  p.avatar_url,
  p.approval_status,
  p.is_available_now,
  p.years_experience,
  p.language,
  p.video_url,
  p.approach,
  p.formations,
  p.created_at,
  p.clinic_settings
FROM public.profiles p
WHERE p.user_type = 'psychologue';

GRANT SELECT ON public.psychologist_directory TO anon, authenticated;

-- New column appended at the end (after `status`) so CREATE OR REPLACE VIEW
-- can be used here — the existing psychologist_id/booked_at/status columns
-- keep their names and positions.
CREATE OR REPLACE VIEW public.psychologist_availability AS
SELECT
  psychologist_id,
  booked_at,
  status,
  duration_minutes
FROM public.bookings
WHERE status <> 'cancelled';

GRANT SELECT ON public.psychologist_availability TO anon, authenticated;
