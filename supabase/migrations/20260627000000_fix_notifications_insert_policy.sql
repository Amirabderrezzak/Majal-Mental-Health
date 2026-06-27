-- Fix: Restrict notifications INSERT to SECURITY DEFINER functions only
-- Previously any authenticated user could spam notifications to any user_id

-- Drop the permissive policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Replace with a restrictive policy: only allow inserts where the user_id
-- does NOT match the auth user (i.e., triggers inserting for others),
-- OR use a function-based approach.
-- Since all inserts come from SECURITY DEFINER triggers, we restrict
-- direct inserts to only allow inserting notifications for yourself
-- (needed if any client-side code creates notifications for the current user).
CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);
