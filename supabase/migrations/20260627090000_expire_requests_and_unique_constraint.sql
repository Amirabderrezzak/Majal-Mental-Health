-- Auto-expire immediate session requests when expires_at is reached
-- This ensures expired requests are marked even if the client-side timer fails

CREATE OR REPLACE FUNCTION expire_immediate_requests()
RETURNS void AS $$
BEGIN
  UPDATE public.immediate_session_requests
  SET status = 'expired', responded_at = now()
  WHERE status = 'pending' AND expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Note: Supabase doesn't support pg_cron directly.
-- Use this as a fallback: call expire_immediate_requests() from your API endpoints
-- or from a Vercel Cron Job.

-- Add a UNIQUE constraint to prevent duplicate pending requests per patient-psychologist pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_request
  ON public.immediate_session_requests (patient_id, psychologist_id)
  WHERE status = 'pending';
