-- Fix handle_new_user: ON CONFLICT should UPDATE instead of silently doing nothing
-- If a user is re-created (e.g., after admin deletion), their profile should be refreshed

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_type TEXT;
  v_approval  TEXT;
BEGIN
  v_user_type := COALESCE(NEW.raw_user_meta_data->>'user_type', 'patient');
  IF v_user_type = 'psychologue' THEN
    v_approval := 'pending';
  ELSE
    v_approval := 'approved';
  END IF;

  INSERT INTO public.profiles (
    user_id, full_name, phone, user_type,
    order_number, specialty, city, approval_status
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_user_type,
    NEW.raw_user_meta_data->>'order_number',
    NEW.raw_user_meta_data->>'specialty',
    NEW.raw_user_meta_data->>'city',
    v_approval
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    user_type = EXCLUDED.user_type,
    order_number = EXCLUDED.order_number,
    specialty = EXCLUDED.specialty,
    city = EXCLUDED.city,
    approval_status = EXCLUDED.approval_status,
    updated_at = now();

  RETURN NEW;
END;
$$;
