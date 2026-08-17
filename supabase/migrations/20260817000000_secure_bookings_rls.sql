-- ============================================================
-- P0-2: Lock down bookings INSERT
-- Bookings must ONLY be created server-side (service-role key, via
-- /api/payments/confirm or /api/payments/webhook) AFTER a payment is
-- verified with the gateway. The previous client-side INSERT policy let
-- any authenticated patient insert a `confirmed` booking with an arbitrary
-- price/psychologist, fully bypassing payment.
-- ============================================================

DROP POLICY IF EXISTS "Patients can create bookings" ON public.bookings;
