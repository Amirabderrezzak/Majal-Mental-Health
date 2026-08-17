-- Add therapist "approach" (Approche thérapeutique) and "formations"
-- (Formations & Diplômes) so they are real, therapist-authored fields
-- instead of hard-coded placeholders shown to every patient.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approach TEXT,
  ADD COLUMN IF NOT EXISTS formations TEXT;
