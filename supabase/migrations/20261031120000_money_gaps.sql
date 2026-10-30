-- Razorpay's actual fee+tax for the payment a purchase was split on. A refund
-- claws back net + processing from the author, since Razorpay keeps its fee.
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS processing_paise integer;

-- One credit per Razorpay payment. Membership charges are recorded as
-- purchases keyed by payment id, so a replayed subscription.charged webhook
-- hits this index and credits nothing.
CREATE UNIQUE INDEX IF NOT EXISTS purchases_razorpay_payment_id_key
  ON public.purchases (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;
