-- ============================================================
-- Fix psychologist profile RLS bug
-- ============================================================
CREATE POLICY "Therapists can view patient profiles for active bookings"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.patient_id = public.profiles.user_id AND b.psychologist_id = auth.uid()
    )
  );

-- ============================================================
-- Add video room URL column to bookings
-- ============================================================
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS video_room_url TEXT;

-- ============================================================
-- Harden storage policies for chat_attachments
-- ============================================================
DROP POLICY IF EXISTS "Users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view chat attachments" ON storage.objects;

CREATE POLICY "Users can upload own chat attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat_attachments'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own chat attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'chat_attachments'
    AND auth.role() = 'authenticated'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.messages m
        WHERE (m.file_url LIKE '%' || name OR m.file_url LIKE '%' || encode(name::bytea, 'escape'))
        AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
      )
    )
  );

-- ============================================================
-- Social features: Stories / Reflections Table & Policies
-- ============================================================
CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  bg_gradient TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved stories"
  ON public.stories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = stories.author_id AND p.approval_status = 'approved'
    )
    OR auth.uid() = author_id
  );

CREATE POLICY "Therapists can insert own stories"
  ON public.stories FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.user_type = 'psychologue'
    )
  );

CREATE POLICY "Therapists can delete own stories"
  ON public.stories FOR DELETE
  USING (auth.uid() = author_id);

-- ============================================================
-- Social features: Forum Threads Table & Policies
-- ============================================================
CREATE TABLE public.forum_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('anxiety', 'stress', 'relationships', 'selfesteem', 'mood')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read forum threads"
  ON public.forum_threads FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create threads"
  ON public.forum_threads FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = author_id);

CREATE POLICY "Users or admins can delete threads"
  ON public.forum_threads FOR DELETE
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  );

-- ============================================================
-- Social features: Forum Replies Table & Policies
-- ============================================================
CREATE TABLE public.forum_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read forum replies"
  ON public.forum_replies FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create replies"
  ON public.forum_replies FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = author_id);

CREATE POLICY "Users or admins can delete replies"
  ON public.forum_replies FOR DELETE
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  );

-- ============================================================
-- Social features: Gratitudes Table & Policies
-- ============================================================
CREATE TABLE public.gratitudes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  color TEXT NOT NULL,
  rotation NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gratitudes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view gratitude wall notes"
  ON public.gratitudes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert gratitudes"
  ON public.gratitudes FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (author_id IS NULL OR auth.uid() = author_id)
  );

CREATE POLICY "Users or admins can delete gratitudes"
  ON public.gratitudes FOR DELETE
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  );
