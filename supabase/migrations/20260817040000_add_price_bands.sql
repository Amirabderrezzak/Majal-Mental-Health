-- Per-session-type price bands with hard DB caps.
-- NULL means the therapist does not offer that session type.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS price_individual   INT,
  ADD COLUMN IF NOT EXISTS price_couples      INT,
  ADD COLUMN IF NOT EXISTS price_adolescents  INT;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_price_individual_chk
    CHECK (price_individual IS NULL OR price_individual BETWEEN 1900 AND 3200),
  ADD CONSTRAINT profiles_price_couples_chk
    CHECK (price_couples IS NULL OR price_couples BETWEEN 3500 AND 5200),
  ADD CONSTRAINT profiles_price_adolescents_chk
    CHECK (price_adolescents IS NULL OR price_adolescents BETWEEN 1500 AND 3000);
