-- P2-5: Hide therapist PII (phone, email, internal flags) from the public.
-- Expose a SECURITY-DEFINER-style view (owned by the migration superuser, so it
-- bypasses base-table RLS) that returns ONLY vetted public columns for
-- psychologist profiles. Then tighten the base `profiles` RLS so the anon key
-- can no longer SELECT the base table publicly.

-- 1. Public, PII-scrubbed directory view.
--    Mirrors the existing `audio_rooms_public` pattern (superuser-owned view
--    bypassing RLS for anon/authenticated readers).
CREATE OR REPLACE VIEW public.psychologist_directory AS
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
  p.created_at
FROM public.profiles p
WHERE p.user_type = 'psychologue';

-- 2. Grant public read on the safe view only.
GRANT SELECT ON public.psychologist_directory TO anon, authenticated;

-- 3. Tighten base-table RLS: the anon key must no longer be able to SELECT the
--    base table publicly. Replace the broad "Anyone can view psychologist
--    profiles" policy with one that requires an authenticated role (still blocks
--    anon) while preserving self-read (auth.uid() = user_id). Service-role
--    bypass of RLS is unaffected, and the admin dashboard (authenticated) keeps
--    read access to psychologist rows.
DROP POLICY IF EXISTS "Anyone can view psychologist profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view psychologist profiles"
  ON public.profiles FOR SELECT
  USING (
    (auth.role() = 'authenticated' AND user_type = 'psychologue')
    OR auth.uid() = user_id
  );
