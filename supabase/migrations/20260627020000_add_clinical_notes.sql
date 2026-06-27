-- Clinical notes table: replaces localStorage for therapist-patient notes
CREATE TABLE IF NOT EXISTS public.clinical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (psychologist_id, patient_id)
);

ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;

-- Only the psychologist can read their own notes for their patients
CREATE POLICY "Psychologists can read own clinical notes"
  ON public.clinical_notes FOR SELECT
  USING (auth.uid() = psychologist_id);

-- Only the psychologist can insert notes for their patients
CREATE POLICY "Psychologists can insert own clinical notes"
  ON public.clinical_notes FOR INSERT
  WITH CHECK (auth.uid() = psychologist_id);

-- Only the psychologist can update their own notes
CREATE POLICY "Psychologists can update own clinical notes"
  ON public.clinical_notes FOR UPDATE
  USING (auth.uid() = psychologist_id);

-- Only the psychologist can delete their own notes
CREATE POLICY "Psychologists can delete own clinical notes"
  ON public.clinical_notes FOR DELETE
  USING (auth.uid() = psychologist_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_clinical_notes_psychologist_patient
  ON public.clinical_notes (psychologist_id, patient_id);
