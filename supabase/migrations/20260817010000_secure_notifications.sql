-- =========================================================================
-- P1-2 Security: Tighten notifications RLS INSERT policy
-- =========================================================================
--
-- Problem: the original notifications table allowed clients to INSERT rows with
-- `WITH CHECK (true)` (policy "System can insert notifications"), so any
-- authenticated user could spoof in-app notifications for ANY user_id.
--
-- Fix: clients may only INSERT notifications where user_id = auth.uid()
-- (i.e. only for their own account). Legitimate server-generated
-- notifications (new booking -> therapist, booking status -> patient, new
-- message -> receiver, no-show notices from push-cron) are created by
-- server-side flows using the SERVICE ROLE client. The service role BYPASSES
-- RLS entirely, so those inserts are unaffected and the notification triggers
-- (handle_new_booking_notification, handle_booking_status_notification,
-- handle_new_message_notification) keep working. We intentionally do NOT
-- remove those triggers.
--
-- SELECT/UPDATE/DELETE policies (user sees/manages only their own rows) are
-- left intact.

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Remove the over-permissive insert policy if it still exists.
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;

-- Strict client insert policy: a user can only create notifications for themselves.
CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Preserve the legitimate read/manage policies (idempotent).
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);
