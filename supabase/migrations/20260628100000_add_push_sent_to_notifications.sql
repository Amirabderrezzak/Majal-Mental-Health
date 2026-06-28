-- Add push_sent column to track which notifications have been sent as push
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_sent boolean DEFAULT false;

-- Index for the cron job to efficiently find unsent notifications
CREATE INDEX IF NOT EXISTS idx_notifications_push_unsent ON notifications (created_at) WHERE push_sent = false;
