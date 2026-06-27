-- Sprint 3C: Immediate session requests ("Parler maintenant")
-- Stores requests from patients wanting to start a session right away

CREATE TABLE IF NOT EXISTS public.immediate_session_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  psychologist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '90 seconds'),
  responded_at TIMESTAMPTZ
);

-- RLS policies
ALTER TABLE public.immediate_session_requests ENABLE ROW LEVEL SECURITY;

-- Patients can create requests
CREATE POLICY "Patients can create immediate requests"
  ON public.immediate_session_requests FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

-- Patients can view their own requests
CREATE POLICY "Patients can view own requests"
  ON public.immediate_session_requests FOR SELECT
  USING (auth.uid() = patient_id);

-- Psychologists can view requests sent to them
CREATE POLICY "Psychologists can view requests sent to them"
  ON public.immediate_session_requests FOR SELECT
  USING (auth.uid() = psychologist_id);

-- Psychologists can update requests sent to them (accept/decline)
CREATE POLICY "Psychologists can update own requests"
  ON public.immediate_session_requests FOR UPDATE
  USING (auth.uid() = psychologist_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_immediate_requests_status ON public.immediate_session_requests(status);
CREATE INDEX IF NOT EXISTS idx_immediate_requests_psychologist ON public.immediate_session_requests(psychologist_id);
CREATE INDEX IF NOT EXISTS idx_immediate_requests_expires ON public.immediate_session_requests(expires_at);

-- Enable realtime for this table
ALTER TABLE public.immediate_session_requests REPLICA IDENTITY FULL;
