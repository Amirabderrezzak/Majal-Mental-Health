-- Sprint 1: Add video presentation and availability features

-- 1. Add video_url and is_available_now to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS is_available_now BOOLEAN NOT NULL DEFAULT false;

-- 2. Create storage bucket for presentation videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('presentation_videos', 'presentation_videos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Drop and recreate storage policies (idempotent)
DROP POLICY IF EXISTS "Therapists can upload own presentation video" ON storage.objects;
CREATE POLICY "Therapists can upload own presentation video"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'presentation_videos'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

DROP POLICY IF EXISTS "Anyone can view presentation videos" ON storage.objects;
CREATE POLICY "Anyone can view presentation videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'presentation_videos');

DROP POLICY IF EXISTS "Therapists can update own presentation video" ON storage.objects;
CREATE POLICY "Therapists can update own presentation video"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'presentation_videos'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

DROP POLICY IF EXISTS "Therapists can delete own presentation video" ON storage.objects;
CREATE POLICY "Therapists can delete own presentation video"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'presentation_videos'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- 4. Enable realtime for is_available_now changes
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
