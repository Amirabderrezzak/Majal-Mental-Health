-- ============================================================
-- Messages Table & Chat Logic
-- ============================================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  file_url TEXT,
  file_type TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Turn on realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Select Policy: Users can only read messages where they are sender or receiver
CREATE POLICY "Users can read their own messages"
  ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Insert Policy: Users can insert if they are the sender
CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);


-- ============================================================
-- Storage Bucket for Attachments (Images, Voice, Files)
-- ============================================================
-- Attempt to insert the bucket if it does not exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat_attachments', 'chat_attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "Users can upload chat attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat_attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view chat attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat_attachments' AND auth.role() = 'authenticated');
