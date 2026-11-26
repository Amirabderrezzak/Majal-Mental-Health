-- ============================================================================
-- End-to-end audit fixes (2026-11-26)
-- Each block names the problem it fixes. Idempotent where practical.
-- ============================================================================

-- ── Helpers ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_approved_psychologist(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_id AND user_type = 'psychologue' AND approval_status = 'approved'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_approved_psychologist(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_psychologist(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_id AND user_type = 'psychologue');
$$;
REVOKE ALL ON FUNCTION public.is_psychologist(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_psychologist(uuid) TO authenticated;

-- ── 1. Therapist PII readable by every logged-in account ────────────────────
-- "Authenticated users can view psychologist profiles" exposed every column of
-- every therapist row (phone, licence number, admin flag, pending/rejected
-- accounts) to any signed-up patient. Public data lives in the directory view.
DROP POLICY IF EXISTS "Authenticated users can view psychologist profiles" ON public.profiles;

-- Therapists see a patient's profile only for real (paid) sessions, not for a
-- checkout the patient abandoned.
DROP POLICY IF EXISTS "Therapists can view patient profiles for active bookings" ON public.profiles;
CREATE POLICY "Therapists can view patient profiles for active bookings"
  ON public.profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.patient_id = profiles.user_id AND b.psychologist_id = auth.uid()
      AND b.status IN ('confirmed', 'done', 'no-show')
  ));

-- Name/avatar card for therapists a patient can see: approved ones, plus any
-- therapist the caller has a booking with (so past sessions keep a name even if
-- the therapist is later unlisted). No PII.
CREATE OR REPLACE VIEW public.psychologist_cards AS
SELECT p.user_id, p.full_name, p.avatar_url, p.specialty
FROM public.profiles p
WHERE p.user_type = 'psychologue'
  AND (
    p.approval_status = 'approved'
    OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.psychologist_id = p.user_id AND b.patient_id = auth.uid())
  );
REVOKE ALL ON public.psychologist_cards FROM anon, authenticated;
GRANT SELECT ON public.psychologist_cards TO anon, authenticated;

-- Homepage counters: anonymous visitors could not count anything under RLS, so
-- the landing page always showed 0 psychologists / 0 sessions.
CREATE OR REPLACE FUNCTION public.public_stats()
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'psychologists', (SELECT count(*) FROM public.profiles WHERE user_type = 'psychologue' AND approval_status = 'approved'),
    'sessions', (SELECT count(*) FROM public.bookings WHERE status = 'done')
  );
$$;
GRANT EXECUTE ON FUNCTION public.public_stats() TO anon, authenticated;

-- user_type was free text taken from signup metadata.
UPDATE public.profiles SET user_type = 'patient' WHERE user_type NOT IN ('patient', 'psychologue');
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_type_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_type_check CHECK (user_type IN ('patient', 'psychologue'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_type TEXT;
BEGIN
  v_user_type := CASE WHEN NEW.raw_user_meta_data->>'user_type' = 'psychologue' THEN 'psychologue' ELSE 'patient' END;
  INSERT INTO public.profiles (user_id, full_name, phone, user_type, order_number, specialty, city, approval_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_user_type,
    NEW.raw_user_meta_data->>'order_number',
    NEW.raw_user_meta_data->>'specialty',
    NEW.raw_user_meta_data->>'city',
    CASE WHEN v_user_type = 'psychologue' THEN 'pending' ELSE 'approved' END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type,
    order_number = EXCLUDED.order_number, specialty = EXCLUDED.specialty, city = EXCLUDED.city,
    approval_status = EXCLUDED.approval_status, updated_at = now();
  RETURN NEW;
END;
$$;

-- ── 2. One price everywhere ─────────────────────────────────────────────────
-- Listing/profile showed price_per_session (or a hard-coded 3000 DZD) while
-- checkout charged price_individual. price_individual etc. are the truth;
-- price_per_session is kept as the derived "from" price (cheapest offered type).
UPDATE public.profiles
SET price_individual = price_per_session
WHERE user_type = 'psychologue' AND price_individual IS NULL
  AND price_per_session BETWEEN 1900 AND 3200;

CREATE OR REPLACE FUNCTION public.sync_headline_price()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.price_per_session := LEAST(NEW.price_individual, NEW.price_couples, NEW.price_adolescents);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sync_headline_price ON public.profiles;
CREATE TRIGGER sync_headline_price BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_headline_price();
UPDATE public.profiles SET price_per_session = LEAST(price_individual, price_couples, price_adolescents)
WHERE user_type = 'psychologue';

-- Languages: therapists had no field to set them, so the column held the
-- signup default 'fr' while the directory filter looked for "Français"/"Arabe".
UPDATE public.profiles SET language = 'Français' WHERE language IS NULL OR lower(language) IN ('fr', 'français', 'francais');
UPDATE public.profiles SET language = 'Arabe' WHERE lower(language) IN ('ar', 'arabe', 'arabic');
ALTER TABLE public.profiles ALTER COLUMN language SET DEFAULT 'Français';

-- ── 3. Bookings: reschedule anchor, attendance, instant sessions ───────────
ALTER TABLE public.bookings
  -- Rescheduling must not reset the cancellation clock (reschedule to next week,
  -- then cancel = 100% refund instead of 70% / 0%).
  ADD COLUMN IF NOT EXISTS policy_anchor_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reschedule_count INT NOT NULL DEFAULT 0,
  -- Who was absent: a session where the therapist never opened the room was
  -- previously recorded as the *patient's* no-show.
  ADD COLUMN IF NOT EXISTS no_show_party TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT,
  ADD COLUMN IF NOT EXISTS session_kind TEXT NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS instant_request_id UUID REFERENCES public.immediate_session_requests(id) ON DELETE SET NULL,
  -- The daily job could e-mail the same reminder twice when re-run.
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_no_show_party_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_no_show_party_check
  CHECK (no_show_party IS NULL OR no_show_party IN ('patient', 'psychologist', 'both'));
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_cancelled_by_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_cancelled_by_check
  CHECK (cancelled_by IS NULL OR cancelled_by IN ('patient', 'psychologist', 'system'));
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_session_kind_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_session_kind_check
  CHECK (session_kind IN ('scheduled', 'instant'));

-- Public availability: an abandoned checkout (pending > 30 min) no longer blocks
-- the slot on the calendar; the server already treated it as free.
CREATE OR REPLACE VIEW public.psychologist_availability AS
SELECT psychologist_id, booked_at, status, duration_minutes
FROM public.bookings
WHERE status <> 'cancelled'
  AND NOT (status = 'pending' AND created_at < now() - interval '30 minutes');
REVOKE ALL ON public.psychologist_availability FROM anon, authenticated;
GRANT SELECT ON public.psychologist_availability TO anon, authenticated;

-- ── 4. Booking notifications: only for paid sessions, in Algiers time ──────
-- The old triggers told the therapist "Nouvelle réservation" for every unpaid
-- slot hold, told the patient "Séance annulée" when they abandoned a checkout,
-- and printed times in UTC (one hour behind Algeria).
CREATE OR REPLACE FUNCTION public.fmt_algiers(ts timestamptz)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT to_char(ts AT TIME ZONE 'Africa/Algiers', 'DD/MM/YYYY "à" HH24:MI') || ' (heure d''Alger)';
$$;

CREATE OR REPLACE FUNCTION public.handle_new_booking_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE patient_name TEXT;
BEGIN
  IF NEW.status <> 'confirmed' THEN RETURN NEW; END IF;
  SELECT full_name INTO patient_name FROM public.profiles WHERE user_id = NEW.patient_id;
  INSERT INTO public.notifications (user_id, title, content, type, link)
  VALUES (NEW.psychologist_id, 'Nouvelle réservation',
    COALESCE(NULLIF(patient_name, ''), 'Un patient') || ' a réservé une séance le ' || public.fmt_algiers(NEW.booked_at) || '.',
    'booking', '/espace-psy?page=sessions');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_booking_status_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  therapist_name TEXT;
  patient_name TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  -- Abandoned / failed checkout: nothing happened from the user's point of view.
  IF OLD.status = 'pending' AND NEW.status = 'cancelled' THEN RETURN NEW; END IF;
  -- No-shows are announced by the attendance job with the right wording.
  IF NEW.status = 'no-show' THEN RETURN NEW; END IF;

  SELECT full_name INTO therapist_name FROM public.profiles WHERE user_id = NEW.psychologist_id;
  therapist_name := COALESCE(NULLIF(therapist_name, ''), 'votre thérapeute');

  IF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
    SELECT full_name INTO patient_name FROM public.profiles WHERE user_id = NEW.patient_id;
    INSERT INTO public.notifications (user_id, title, content, type, link) VALUES
      (NEW.psychologist_id, 'Nouvelle réservation',
       COALESCE(NULLIF(patient_name, ''), 'Un patient') || ' a réservé une séance le ' || public.fmt_algiers(NEW.booked_at) || '.',
       'booking', '/espace-psy?page=sessions'),
      (NEW.patient_id, 'Séance confirmée',
       'Votre séance avec ' || therapist_name || ' le ' || public.fmt_algiers(NEW.booked_at) || ' est confirmée.',
       'booking', '/mon-espace?page=sessions');
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled' THEN
    IF NEW.cancelled_by = 'patient' THEN
      SELECT full_name INTO patient_name FROM public.profiles WHERE user_id = NEW.patient_id;
      INSERT INTO public.notifications (user_id, title, content, type, link) VALUES
        (NEW.psychologist_id, 'Séance annulée',
         COALESCE(NULLIF(patient_name, ''), 'Le patient') || ' a annulé la séance du ' || public.fmt_algiers(NEW.booked_at) || '.',
         'booking', '/espace-psy?page=sessions');
    ELSE
      INSERT INTO public.notifications (user_id, title, content, type, link) VALUES
        (NEW.patient_id, 'Séance annulée',
         'Votre séance avec ' || therapist_name || ' du ' || public.fmt_algiers(NEW.booked_at) || ' a été annulée.',
         'booking', '/mon-espace?page=sessions');
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'done' THEN
    INSERT INTO public.notifications (user_id, title, content, type, link) VALUES
      (NEW.patient_id, 'Séance terminée',
       'Votre séance avec ' || therapist_name || ' est terminée. Vous pouvez laisser un avis si vous le souhaitez.',
       'booking', '/mon-espace?page=sessions');
  END IF;
  RETURN NEW;
END;
$$;

-- ── 5. Payments ↔ bookings, and a refund ledger ────────────────────────────
-- confirm's idempotent path guessed "the latest booking for this pair"; record
-- the booking a payment produced instead.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instant_request_id UUID REFERENCES public.immediate_session_requests(id) ON DELETE SET NULL;

-- Refunds and therapist compensation existed only as sentences in emails; no
-- record was kept and nothing told an admin money had to be returned.
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  psychologist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL CHECK (amount >= 0),
  refund_percent INT NOT NULL CHECK (refund_percent BETWEEN 0 AND 100),
  compensation_amount INT NOT NULL DEFAULT 0 CHECK (compensation_amount >= 0),
  reason TEXT NOT NULL CHECK (reason IN ('patient_cancel', 'therapist_cancel', 'therapist_no_show', 'both_absent', 'paid_without_booking')),
  status TEXT NOT NULL DEFAULT 'due' CHECK (status IN ('due', 'processed', 'waived')),
  note TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refunds_one_per_booking ON public.refunds (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds (status);
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Patients see own refunds" ON public.refunds;
CREATE POLICY "Patients see own refunds" ON public.refunds FOR SELECT USING (auth.uid() = patient_id);
DROP POLICY IF EXISTS "Therapists see refunds on their sessions" ON public.refunds;
CREATE POLICY "Therapists see refunds on their sessions" ON public.refunds FOR SELECT USING (auth.uid() = psychologist_id);
DROP POLICY IF EXISTS "Admins read refunds" ON public.refunds;
CREATE POLICY "Admins read refunds" ON public.refunds FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Admins update refunds" ON public.refunds;
CREATE POLICY "Admins update refunds" ON public.refunds FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── 6. Reviews: only after a completed session, one per session, no patient id leak
-- Anyone signed in could post unlimited reviews of any therapist (the
-- one-per-booking check compared NULL booking ids), and every review exposed
-- the reviewer's user id publicly.
DROP POLICY IF EXISTS "Patients can create one review per booking" ON public.reviews;
CREATE POLICY "Patients can review a completed session"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = patient_id
    AND booking_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = reviews.booking_id AND b.patient_id = auth.uid()
        AND b.psychologist_id = reviews.psychologist_id AND b.status = 'done'
    )
  );
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_one_per_booking ON public.reviews (booking_id) WHERE booking_id IS NOT NULL;
DROP POLICY IF EXISTS "Patients can update own reviews" ON public.reviews;
CREATE POLICY "Patients can update own reviews" ON public.reviews FOR UPDATE
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id AND rating BETWEEN 1 AND 5);

DROP POLICY IF EXISTS "Reviews are publicly readable" ON public.reviews;
DROP POLICY IF EXISTS "Patients read own reviews" ON public.reviews;
CREATE POLICY "Patients read own reviews" ON public.reviews FOR SELECT USING (auth.uid() = patient_id);
DROP POLICY IF EXISTS "Admins read all reviews" ON public.reviews;
CREATE POLICY "Admins read all reviews" ON public.reviews FOR SELECT USING (public.is_admin());

CREATE OR REPLACE VIEW public.reviews_public AS
SELECT r.id, r.psychologist_id, r.rating, r.comment, r.created_at, (r.patient_id = auth.uid()) AS is_mine
FROM public.reviews r;
REVOKE ALL ON public.reviews_public FROM anon, authenticated;
GRANT SELECT ON public.reviews_public TO anon, authenticated;

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_comment_length;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_comment_length CHECK (comment IS NULL OR char_length(comment) <= 2000) NOT VALID;

-- ── 7. Forum anonymity was cosmetic ─────────────────────────────────────────
-- author_id was readable without logging in and equals the id a therapist sees
-- on their bookings, so a therapist could find which posts their patients wrote.
DROP POLICY IF EXISTS "Anyone can read forum threads" ON public.forum_threads;
DROP POLICY IF EXISTS "Authors read own threads" ON public.forum_threads;
CREATE POLICY "Authors read own threads" ON public.forum_threads FOR SELECT USING (auth.uid() = author_id OR public.is_admin());
DROP POLICY IF EXISTS "Anyone can read forum replies" ON public.forum_replies;
DROP POLICY IF EXISTS "Authors read own replies" ON public.forum_replies;
CREATE POLICY "Authors read own replies" ON public.forum_replies FOR SELECT USING (auth.uid() = author_id OR public.is_admin());

CREATE OR REPLACE VIEW public.forum_threads_public AS
SELECT t.id, t.category, t.title, t.content, t.created_at,
       (t.author_id = auth.uid()) AS is_mine,
       CASE WHEN p.user_type = 'psychologue' AND p.approval_status = 'approved' THEN p.full_name END AS author_label
FROM public.forum_threads t
LEFT JOIN public.profiles p ON p.user_id = t.author_id;
CREATE OR REPLACE VIEW public.forum_replies_public AS
SELECT r.id, r.thread_id, r.content, r.created_at,
       (r.author_id = auth.uid()) AS is_mine,
       CASE WHEN p.user_type = 'psychologue' AND p.approval_status = 'approved' THEN p.full_name END AS author_label
FROM public.forum_replies r
LEFT JOIN public.profiles p ON p.user_id = r.author_id;
REVOKE ALL ON public.forum_threads_public, public.forum_replies_public FROM anon, authenticated;
GRANT SELECT ON public.forum_threads_public, public.forum_replies_public TO anon, authenticated;

ALTER TABLE public.forum_threads DROP CONSTRAINT IF EXISTS forum_threads_length;
ALTER TABLE public.forum_threads ADD CONSTRAINT forum_threads_length CHECK (char_length(title) <= 200 AND char_length(content) <= 5000) NOT VALID;
ALTER TABLE public.forum_replies DROP CONSTRAINT IF EXISTS forum_replies_length;
ALTER TABLE public.forum_replies ADD CONSTRAINT forum_replies_length CHECK (char_length(content) <= 5000) NOT VALID;

-- Stories: the visibility policy looked up the author in profiles under RLS,
-- which (now correctly) hides therapist rows — use the definer helper.
DROP POLICY IF EXISTS "Anyone can view approved stories" ON public.stories;
CREATE POLICY "Anyone can view approved stories" ON public.stories FOR SELECT
  USING (public.is_approved_psychologist(author_id) OR auth.uid() = author_id);
DROP POLICY IF EXISTS "Therapists can insert own stories" ON public.stories;
CREATE POLICY "Therapists can insert own stories" ON public.stories FOR INSERT
  WITH CHECK (auth.uid() = author_id AND public.is_approved_psychologist(auth.uid()));

-- ── 8. Instant ("Parler maintenant") requests ──────────────────────────────
-- Therapists could set status/room_url directly (bypassing the API) and patients
-- could not withdraw a request at all (their 90 s timeout update was a no-op).
DROP POLICY IF EXISTS "Psychologists can update own requests" ON public.immediate_session_requests;
CREATE POLICY "Psychologists can decline own requests" ON public.immediate_session_requests FOR UPDATE
  USING (auth.uid() = psychologist_id AND status = 'pending')
  WITH CHECK (auth.uid() = psychologist_id AND status = 'declined');
DROP POLICY IF EXISTS "Patients can withdraw own requests" ON public.immediate_session_requests;
CREATE POLICY "Patients can withdraw own requests" ON public.immediate_session_requests FOR UPDATE
  USING (auth.uid() = patient_id AND status = 'pending')
  WITH CHECK (auth.uid() = patient_id AND status = 'expired');

CREATE OR REPLACE FUNCTION public.expire_immediate_requests()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.immediate_session_requests
  SET status = 'expired', responded_at = now()
  WHERE status = 'pending' AND expires_at < now();
END;
$$;
REVOKE ALL ON FUNCTION public.expire_immediate_requests() FROM PUBLIC, anon, authenticated;

-- ── 9. Small integrity fixes ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Psychologists can insert own specializations" ON public.psy_specializations;
CREATE POLICY "Psychologists can insert own specializations" ON public.psy_specializations FOR INSERT
  WITH CHECK (auth.uid() = psychologist_id AND public.is_psychologist(auth.uid()));
DROP POLICY IF EXISTS "Psychologists can view own specializations" ON public.psy_specializations;

-- Clinical notes only about someone who actually is the therapist's patient.
DROP POLICY IF EXISTS "Psychologists can insert own clinical notes" ON public.clinical_notes;
CREATE POLICY "Psychologists can insert own clinical notes" ON public.clinical_notes FOR INSERT
  WITH CHECK (auth.uid() = psychologist_id AND EXISTS (
    SELECT 1 FROM public.bookings b WHERE b.psychologist_id = auth.uid() AND b.patient_id = clinical_notes.patient_id
      AND b.status IN ('confirmed', 'done', 'no-show')));
DROP POLICY IF EXISTS "Psychologists can update own clinical notes" ON public.clinical_notes;
CREATE POLICY "Psychologists can update own clinical notes" ON public.clinical_notes FOR UPDATE
  USING (auth.uid() = psychologist_id) WITH CHECK (auth.uid() = psychologist_id);

ALTER TABLE public.notifications ALTER COLUMN push_sent SET DEFAULT false;
UPDATE public.notifications SET push_sent = true WHERE push_sent IS NULL;
ALTER TABLE public.notifications ALTER COLUMN push_sent SET NOT NULL;

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_content_length;
ALTER TABLE public.messages ADD CONSTRAINT messages_content_length CHECK (content IS NULL OR char_length(content) <= 5000) NOT VALID;

-- ── 10. Audio rooms that never ended ───────────────────────────────────────
-- Daily rooms expire after 1 h but the row stayed is_live = true forever, so the
-- Explore page listed dead rooms indefinitely.
ALTER TABLE public.audio_rooms ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
UPDATE public.audio_rooms SET ends_at = created_at + interval '1 hour' WHERE ends_at IS NULL;
ALTER TABLE public.audio_rooms ALTER COLUMN ends_at SET DEFAULT (now() + interval '1 hour');

CREATE OR REPLACE VIEW public.audio_rooms_public AS
SELECT ar.id, ar.title, ar.host_id, ar.is_live, ar.created_at, ar.participant_count, p.full_name AS host_name
FROM public.audio_rooms ar
LEFT JOIN public.profiles p ON p.user_id = ar.host_id
WHERE ar.is_live = true AND ar.ends_at > now();
REVOKE ALL ON public.audio_rooms_public FROM anon, authenticated;
GRANT SELECT ON public.audio_rooms_public TO anon, authenticated;

-- Room URLs are now handed out by the API together with a Daily meeting token
-- (the rooms are private); the old RPC returned a bare URL nobody could use.
DROP FUNCTION IF EXISTS public.get_audio_room_url(uuid);

-- Keep the directory/availability views read-only (re-asserted after recreation).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.psychologist_directory, public.psychologist_availability, public.audio_rooms_public,
     public.psychologist_ratings, public.psychologist_cards, public.reviews_public,
     public.forum_threads_public, public.forum_replies_public
  FROM anon, authenticated;
