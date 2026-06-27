-- Add room_url column to immediate_session_requests for instant sessions
ALTER TABLE public.immediate_session_requests
  ADD COLUMN IF NOT EXISTS room_url TEXT;
