-- Add 'no-show' status to bookings CHECK constraint
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'done', 'no-show'));

-- Add index for no-show detection queries
CREATE INDEX IF NOT EXISTS idx_bookings_noshow_check
  ON public.bookings (status, booked_at)
  WHERE status = 'confirmed';

-- Add no_show_detected_at column to track when no-show was recorded
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS no_show_detected_at TIMESTAMPTZ;
