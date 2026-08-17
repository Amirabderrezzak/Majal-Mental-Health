-- Expose the new approach/formations columns in the public, PII-scrubbed
-- directory view so patient-facing pages can render the therapist's real
-- content (they are public-safe, not PII).
-- NOTE: must DROP then CREATE (not CREATE OR REPLACE) because we are
-- changing the view's column set; CREATE OR REPLACE cannot add/rename columns.
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
  p.created_at
FROM public.profiles p
WHERE p.user_type = 'psychologue';

GRANT SELECT ON public.psychologist_directory TO anon, authenticated;
