-- P0: public views were writable by anonymous visitors.
-- psychologist_directory and psychologist_availability are simple, auto-updatable
-- views owned by postgres (no security_invoker), so writes through them bypass the
-- RLS of the underlying profiles table, and anon/authenticated hold
-- INSERT/UPDATE/DELETE/TRUNCATE on them. Views are read-only by design here.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.psychologist_directory,
     public.psychologist_availability,
     public.audio_rooms_public,
     public.psychologist_ratings
  FROM anon, authenticated;

-- phone_verifications: open select/insert/update for everyone (OTP codes readable
-- and forgeable by anybody). The table has no legitimate client access; the
-- service role (API) bypasses RLS.
DROP POLICY IF EXISTS "Allow anonymous insert on phone_verifications" ON public.phone_verifications;
DROP POLICY IF EXISTS "Allow anonymous select on phone_verifications" ON public.phone_verifications;
DROP POLICY IF EXISTS "Allow anonymous update on phone_verifications" ON public.phone_verifications;
REVOKE ALL ON public.phone_verifications FROM anon, authenticated;
