-- Conversation list for the messages pages.
-- Both inboxes were built from bookings only, so a patient who wrote to a
-- therapist before booking (the profile page invites exactly that) was invisible:
-- the therapist saw an unread badge but no conversation, and could not reply.
-- Returns only the people the caller has exchanged messages with, and only
-- their display name / avatar / role (they chose to contact each other).
CREATE OR REPLACE FUNCTION public.my_conversations()
RETURNS TABLE (user_id uuid, full_name text, avatar_url text, user_type text, last_message_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name, p.avatar_url, p.user_type, max(m.created_at) AS last_message_at
  FROM public.messages m
  JOIN public.profiles p
    ON p.user_id = CASE WHEN m.sender_id = auth.uid() THEN m.receiver_id ELSE m.sender_id END
  WHERE auth.uid() IS NOT NULL
    AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
  GROUP BY p.user_id, p.full_name, p.avatar_url, p.user_type
  ORDER BY max(m.created_at) DESC;
$$;
REVOKE ALL ON FUNCTION public.my_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_conversations() TO authenticated;
