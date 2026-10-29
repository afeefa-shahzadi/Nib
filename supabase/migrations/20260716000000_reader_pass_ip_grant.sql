-- Tracks the billing period end up to which the Reader Pass monthly IP grant
-- has been issued. Claimed atomically by the Razorpay webhook so retries and
-- activated+charged double-fires never double-credit.
ALTER TABLE public.reader_subscriptions
  ADD COLUMN IF NOT EXISTS ip_granted_until TIMESTAMP WITH TIME ZONE;
