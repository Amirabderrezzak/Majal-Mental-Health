-- Payments table: holds reservation details until payment succeeds
-- Booking is only created after payment confirmation
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  psychologist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booked_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  price NUMERIC NOT NULL,
  sofizpay_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated', 'pending', 'confirmed', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: patients can read their own payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = patient_id);

CREATE POLICY "Patients can insert own payments"
  ON public.payments FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

-- Service role can update payments (webhook/confirm endpoint)
CREATE POLICY "Service role can update payments"
  ON public.payments FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_sofizpay_tx_id ON public.payments(sofizpay_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
