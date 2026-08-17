-- P2-3: Payment price must be server-authoritative.
-- api/payments/checkout.ts computes `price` from the therapist's profile using
-- the service-role key (which bypasses RLS). The client-side INSERT policy
-- allowed any authenticated user to insert a payments row with an arbitrary
-- `price`, defeating server-side price enforcement.
-- Drop the client INSERT policy; payments are created ONLY by the service-role
-- checkout handler. The SELECT (own payments) and UPDATE (service role) policies
-- below are preserved and remain correct.

DROP POLICY IF EXISTS "Patients can insert own payments" ON public.payments;
