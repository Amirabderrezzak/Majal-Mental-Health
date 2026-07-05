-- 1. Partial unique index: prevent double-booking (one active booking per slot)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking
  ON public.bookings(psychologist_id, booked_at)
  WHERE status != 'cancelled';

-- 2. Auto-update updated_at for payments table
CREATE OR REPLACE FUNCTION public.update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_payments_updated_at();

-- 3. Mark stale pending payments as failed (30 min TTL)
-- Run this as a daily cron via Vercel cron job
