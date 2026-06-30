-- Add push_notifications_enabled column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_notifications_enabled boolean DEFAULT false;
