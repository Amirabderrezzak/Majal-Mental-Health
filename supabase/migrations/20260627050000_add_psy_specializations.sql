-- Sprint 3: Psychologist specialization tags for triple filtering
-- Each psychologist tags themselves with categories/subcategories they handle

CREATE TABLE IF NOT EXISTS public.psy_specializations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  psychologist_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  subcategory_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(psychologist_id, category_id, subcategory_id)
);

-- RLS: psychologists can manage their own specializations
ALTER TABLE public.psy_specializations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Psychologists can view own specializations"
  ON public.psy_specializations FOR SELECT
  USING (auth.uid() = psychologist_id);

CREATE POLICY "Anyone can view psychologist specializations"
  ON public.psy_specializations FOR SELECT
  USING (true);

CREATE POLICY "Psychologists can insert own specializations"
  ON public.psy_specializations FOR INSERT
  WITH CHECK (auth.uid() = psychologist_id);

CREATE POLICY "Psychologists can delete own specializations"
  ON public.psy_specializations FOR DELETE
  USING (auth.uid() = psychologist_id);

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_psy_specializations_category ON public.psy_specializations(category_id);
CREATE INDEX IF NOT EXISTS idx_psy_specializations_subcategory ON public.psy_specializations(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_psy_specializations_psychologist ON public.psy_specializations(psychologist_id);
