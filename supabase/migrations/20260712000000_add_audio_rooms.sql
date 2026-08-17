CREATE TABLE IF NOT EXISTS public.audio_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  room_url TEXT NOT NULL,
  is_live BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audio_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view live audio rooms" ON public.audio_rooms
  FOR SELECT USING (is_live = true);

CREATE POLICY "Hosts manage own audio rooms" ON public.audio_rooms
  FOR ALL
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);
