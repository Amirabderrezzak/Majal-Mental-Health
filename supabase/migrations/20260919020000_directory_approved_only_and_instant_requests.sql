-- 1. The public directory listed every therapist, including pending/rejected ones
--    (unvetted profiles were readable by anyone through the REST API; only the
--    frontend hid them). Show approved therapists only.
CREATE OR REPLACE VIEW public.psychologist_directory AS
 SELECT user_id,
    full_name,
    specialty,
    city,
    bio,
    price_per_session,
    price_individual,
    price_couples,
    price_adolescents,
    avatar_url,
    approval_status,
    is_available_now,
    years_experience,
    language,
    video_url,
    approach,
    formations,
    created_at,
    clinic_settings
   FROM profiles p
  WHERE user_type = 'psychologue'::text
    AND approval_status = 'approved'::text;

-- 2. Instant-session requests could be addressed to ANY user id (pending,
--    rejected, or not a therapist at all). Only approved therapists can receive one.
CREATE OR REPLACE FUNCTION public.is_approved_psychologist(p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_id AND user_type = 'psychologue' AND approval_status = 'approved'
  );
$$;
REVOKE ALL ON FUNCTION public.is_approved_psychologist(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_approved_psychologist(uuid) TO authenticated;

DROP POLICY IF EXISTS "Patients can create immediate requests" ON public.immediate_session_requests;
CREATE POLICY "Patients can create immediate requests"
  ON public.immediate_session_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = patient_id AND public.is_approved_psychologist(psychologist_id));
