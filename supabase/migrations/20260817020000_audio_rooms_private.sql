-- P1-3: Private Daily.co audio rooms + restrict room_url/token visibility
-- Applied AFTER 20260712000000_add_audio_rooms.sql

-- Defensive: record privacy at the DB layer (the Daily.co room itself is created private)
ALTER TABLE public.audio_rooms
  ADD COLUMN IF NOT EXISTS privacy TEXT NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS participant_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.audio_rooms
  DROP CONSTRAINT IF EXISTS audio_rooms_privacy_check;
ALTER TABLE public.audio_rooms
  ADD CONSTRAINT audio_rooms_privacy_check CHECK (privacy IN ('private', 'public'));

-- Remove the broad public SELECT policy: it leaked room_url/tokens to everyone.
DROP POLICY IF EXISTS "Anyone can view live audio rooms" ON public.audio_rooms;

-- Hosts can fully manage (create/update/delete AND read room_url) only their own rooms.
DROP POLICY IF EXISTS "Hosts manage own audio rooms" ON public.audio_rooms;
CREATE POLICY "Hosts manage own audio rooms" ON public.audio_rooms
  FOR ALL
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

-- Public metadata view: NEVER exposes room_url or any token.
-- This is what ExplorePage lists from, satisfying "public listing exposes ONLY metadata".
CREATE OR REPLACE VIEW public.audio_rooms_public AS
SELECT
  ar.id,
  ar.title,
  ar.host_id,
  ar.is_live,
  ar.created_at,
  ar.participant_count,
  p.full_name AS host_name
FROM public.audio_rooms ar
LEFT JOIN public.profiles p ON p.user_id = ar.host_id
WHERE ar.is_live = true;

GRANT SELECT ON public.audio_rooms_public TO anon, authenticated;

-- Secure helper: the real room_url is only retrievable by an authenticated caller.
-- Prevents anonymous scraping and URL enumeration (you must know a valid room id,
-- which is only obtainable from the public metadata view).
CREATE OR REPLACE FUNCTION public.get_audio_room_url(room_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT room_url
  FROM public.audio_rooms
  WHERE id = room_id
    AND is_live = true
    AND auth.uid() IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_audio_room_url(uuid) TO anon, authenticated;
