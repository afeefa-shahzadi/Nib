-- "Apply earnings to Studio" — a creator can spend ₹499 of their withdrawable
-- earnings on a month of Studio instead of a card charge. Access granted this
-- way is time-boxed by studio_credit_until (independent of any Razorpay
-- subscription); getMyPlan honours it and lazily downgrades when it lapses,
-- so no cron is needed. The ₹499 is deducted as a negative earnings_ledger row.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS studio_credit_until TIMESTAMP WITH TIME ZONE;
