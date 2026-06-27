-- Sprint 1: Add video presentation and availability features

-- 1. Add video_url and is_available_now to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS is_available_now BOOLEAN NOT NULL DEFAULT false;

-- 2. Create storage bucket for presentation videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('presentation_videos', 'presentation_videos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policy: therapists can upload their own video
CREATE POLICY "Therapists can upload own presentation video"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'presentation_videos'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- 4. Storage policy: anyone can view presentation videos (public bucket)
CREATE POLICY "Anyone can view presentation videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'presentation_videos');

-- 5. Storage policy: therapists can update their own video
CREATE POLICY "Therapists can update own presentation video"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'presentation_videos'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- 6. Storage policy: therapists can delete their own video
CREATE POLICY "Therapists can delete own presentation video"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'presentation_videos'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- 7. Enable realtime for is_available_now changes
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
