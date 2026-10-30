-- How a parent proved who they are: email link + adult declaration (live during
-- launch), DigiLocker date-of-birth check, or a refunded Rs 1 card charge
-- (both dormant until paid features open).
ALTER TABLE public.parental_consents
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'email'
    CHECK (method IN ('email', 'digilocker', 'card')),
  ADD COLUMN IF NOT EXISTS declared_adult boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reference text; -- Razorpay payment id or DigiLocker transaction id

CREATE INDEX IF NOT EXISTS profiles_parent_email_idx ON public.profiles (parent_email) WHERE parent_email IS NOT NULL;
