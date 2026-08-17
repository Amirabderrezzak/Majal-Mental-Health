ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS clinic_settings JSONB,
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB;
