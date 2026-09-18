-- ============================================================
-- Security hardening pass (full-codebase audit, 2026-09-18)
-- ============================================================

-- P0-1: profiles PII leak — the anon key can still read every column of an
-- approved psychologist's profile (phone, is_admin, clinic_settings,
-- prep_notes, order_number). 20260817060000_secure_profiles_directory.sql
-- intended to close this but dropped a policy NAME that had already been
-- replaced back in 20260419100000_admin_panel.sql ("Anyone can view
-- psychologist profiles" -> "Anyone can view approved psychologist
-- profiles"), so its DROP was a no-op and the old public policy is still
-- live. The safe public surface is the `psychologist_directory` view
-- (superuser-owned, bypasses RLS, already granted to anon/authenticated) —
-- the base table no longer needs to be publicly readable at all.
DROP POLICY IF EXISTS "Anyone can view approved psychologist profiles" ON public.profiles;

-- P0-2: payments UPDATE policy had no role restriction — "Service role can
-- update payments" USING(true) WITH CHECK(true) is a normal RLS policy (no
-- `TO service_role` clause), so it applied to any authenticated client. Any
-- logged-in patient could flip ANY payment's status (their own or someone
-- else's) directly via the Supabase client, e.g. to "confirmed" or
-- "failed", corrupting financial records. The service-role key used by
-- api/_lib/confirm-booking.ts bypasses RLS entirely, so this policy was
-- never actually needed for the app to function — safe to drop outright.
DROP POLICY IF EXISTS "Service role can update payments" ON public.payments;

-- P0-3: bookings INSERT — "Patients can create bookings" WITH CHECK
-- (auth.uid() = patient_id) let any authenticated patient insert a
-- `confirmed` booking directly, with an arbitrary price/psychologist,
-- completely bypassing payment. 20260817000000_secure_bookings_rls.sql
-- (filename dated Aug 17) was written to drop this — but when reconciling
-- this migration against the LIVE database on 2026-09-18, `pg_policies`
-- showed this policy was still active: the local migration history and the
-- live schema had drifted apart (most migrations after April 19 were
-- applied by hand directly in the SQL Editor, inconsistently, rather than
-- via `supabase db push`). Re-asserting the drop here, idempotently.
DROP POLICY IF EXISTS "Patients can create bookings" ON public.bookings;

-- P1: bookings UPDATE policies had no WITH CHECK beyond row ownership, so a
-- psychologist could rewrite any column (price, status, session_type) on
-- their own booking rows directly from the client, bypassing the price
-- bands, status-transition rules, and notification/email side effects
-- enforced in api/bookings.ts (?action=update-status / reschedule). No
-- client code performs a direct `.update()` on bookings (verified via
-- grep) — every mutation already goes through the service-role-backed API,
-- matching the pattern above for INSERT. Lock UPDATE down the same way.
DROP POLICY IF EXISTS "Patients can cancel own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Psychologists can update their bookings" ON public.bookings;
