-- Add performance indexes on frequently queried foreign keys
-- These will speed up dashboard queries, chat loading, and notification feeds

CREATE INDEX IF NOT EXISTS idx_bookings_patient_id ON public.bookings (patient_id);
CREATE INDEX IF NOT EXISTS idx_bookings_psychologist_id ON public.bookings (psychologist_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_booked_at ON public.bookings (booked_at);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages (receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages (created_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications (is_read);

CREATE INDEX IF NOT EXISTS idx_reviews_psychologist_id ON public.reviews (psychologist_id);
CREATE INDEX IF NOT EXISTS idx_reviews_patient_id ON public.reviews (patient_id);
