-- =========================================================================
-- Majal Mental Health — Admin Activation Script
-- =========================================================================
-- Run this script in your Supabase SQL Editor to designate a user as an Admin.
--
-- Steps:
-- 1. Sign up on the website with the email address you want to use for admin.
-- 2. Go to your Supabase Dashboard -> Auth.
-- 3. Copy the "User ID" (UUID) of your admin account.
-- 4. Replace 'YOUR_USER_UUID' below with that ID and click Run.

UPDATE public.profiles
SET is_admin = true
WHERE user_id = 'YOUR_USER_UUID';
