-- =========================================================================
-- Majal — Notifications Table + Triggers (idempotent, safe to re-run)
-- =========================================================================

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('booking', 'message', 'system')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop + recreate policies (idempotent)
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Enable Realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- =========================================================================
-- Trigger Functions
-- =========================================================================

-- 1. New booking → notify therapist
CREATE OR REPLACE FUNCTION public.handle_new_booking_notification()
RETURNS TRIGGER AS $$
DECLARE
  patient_name TEXT;
BEGIN
  SELECT full_name INTO patient_name FROM public.profiles WHERE user_id = NEW.patient_id;
  IF patient_name IS NULL THEN patient_name := 'Un patient'; END IF;

  INSERT INTO public.notifications (user_id, title, content, type, link)
  VALUES (
    NEW.psychologist_id,
    'Nouvelle réservation',
    patient_name || ' a réservé une séance pour le ' || to_char(NEW.booked_at AT TIME ZONE 'UTC', 'DD/MM/YYYY à HH24:MI') || ' UTC',
    'booking',
    '/espace-psy?page=sessions'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_booking_created ON public.bookings;
CREATE TRIGGER on_booking_created
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_booking_notification();

-- 2. Booking status updated → notify patient
CREATE OR REPLACE FUNCTION public.handle_booking_status_notification()
RETURNS TRIGGER AS $$
DECLARE
  therapist_name TEXT;
  status_fr TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT full_name INTO therapist_name FROM public.profiles WHERE user_id = NEW.psychologist_id;
    IF therapist_name IS NULL THEN therapist_name := 'Votre thérapeute'; END IF;

    status_fr := CASE NEW.status
      WHEN 'confirmed' THEN 'confirmée'
      WHEN 'cancelled' THEN 'annulée'
      WHEN 'done' THEN 'terminée'
      ELSE NEW.status
    END;

    INSERT INTO public.notifications (user_id, title, content, type, link)
    VALUES (
      NEW.patient_id,
      'Séance ' || status_fr,
      'Votre séance avec ' || therapist_name || ' du ' || to_char(NEW.booked_at AT TIME ZONE 'UTC', 'DD/MM/YYYY à HH24:MI') || ' UTC a été ' || status_fr || '.',
      'booking',
      '/mon-espace?page=sessions'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_booking_status_updated ON public.bookings;
CREATE TRIGGER on_booking_status_updated
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_booking_status_notification();

-- 3. New message → notify receiver
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
  is_therapist BOOLEAN;
BEGIN
  SELECT full_name, (user_type = 'psychologue') INTO sender_name, is_therapist FROM public.profiles WHERE user_id = NEW.sender_id;
  IF sender_name IS NULL THEN sender_name := 'Quelqu''un'; END IF;

  INSERT INTO public.notifications (user_id, title, content, type, link)
  VALUES (
    NEW.receiver_id,
    'Nouveau message',
    'Vous avez reçu un nouveau message de ' || sender_name,
    'message',
    CASE WHEN is_therapist THEN '/mon-espace?page=messages' ELSE '/espace-psy?page=messages' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_message_created ON public.messages;
CREATE TRIGGER on_message_created
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_message_notification();
