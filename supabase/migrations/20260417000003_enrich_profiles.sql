
-- Add psychologist-specific profile enrichment fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS price_per_session INT,
  ADD COLUMN IF NOT EXISTS years_experience INT;

-- Allow public read access to psychologist profiles (for the listing page)
CREATE POLICY "Anyone can view psychologist profiles"
  ON public.profiles FOR SELECT
  USING (user_type = 'psychologue' OR auth.uid() = user_id);
