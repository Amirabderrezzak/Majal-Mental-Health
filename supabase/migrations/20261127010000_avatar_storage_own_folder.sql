-- Avatars: on the live project, hand-written storage policies let ANY signed-in
-- user upload over, replace or delete ANYONE's avatar (bucket check only, no
-- owner check). They were never in a migration, so 20260918230000 added the
-- owner-scoped policies next to them, but permissive policies are OR-ed and the
-- broad ones would still apply. Drop them; reading stays public.
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete avatars" ON storage.objects;
