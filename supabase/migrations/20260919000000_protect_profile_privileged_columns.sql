-- P0: profile privilege escalation.
-- "Users can update their own profile" is USING (auth.uid() = user_id) with no
-- WITH CHECK and no column restriction, and `authenticated` holds UPDATE on the
-- table, so ANY logged-in user could run
--   UPDATE profiles SET is_admin = true WHERE user_id = <me>
-- and become an admin (is_admin() then grants read/update on every profile and
-- booking and delete on reviews), or a psychologist could self-approve
-- (approval_status = 'approved') and appear in the public directory without
-- vetting, or flip user_type.
--
-- RLS cannot restrict individual columns, so guard them with a trigger:
--  * calls made with a user JWT (auth.uid() IS NOT NULL) by a non-admin may not
--    change is_admin / approval_status / user_type / phone_verified;
--  * inserts by a non-admin are forced to safe defaults;
--  * service-role calls (API functions), SQL editor and the signup trigger
--    handle_new_user() run with auth.uid() IS NULL and are unaffected;
--  * real admins (the admin dashboard approves therapists and grants admin
--    through their own JWT) keep working because is_admin() is true for them.

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_admin := false;
    NEW.phone_verified := false;
    NEW.approval_status := CASE WHEN NEW.user_type = 'psychologue' THEN 'pending' ELSE 'approved' END;
    RETURN NEW;
  END IF;

  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     OR NEW.approval_status IS DISTINCT FROM OLD.approval_status
     OR NEW.user_type IS DISTINCT FROM OLD.user_type
     OR NEW.phone_verified IS DISTINCT FROM OLD.phone_verified THEN
    RAISE EXCEPTION 'You are not allowed to change protected profile fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();
