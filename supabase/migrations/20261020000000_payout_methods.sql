-- Structured payout beneficiaries for RazorpayX disbursement. PII
-- (account_number, pan) is stored encrypted (enc:v1:...) by the app layer;
-- IFSC and VPA are not secret. RazorpayX contact/fund_account ids are cached
-- lazily on first disburse. No authenticated RLS policies: encrypted PII is
-- never read raw by the client — all access is via service-role server actions.
CREATE TABLE IF NOT EXISTS public.payout_methods (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  method_type text NOT NULL CHECK (method_type = ANY (ARRAY['bank_account'::text,'vpa'::text])),
  account_name text,
  account_number text,
  ifsc text,
  vpa text,
  pan text,
  razorpayx_contact_id text,
  razorpayx_fund_account_id text,
  status text NOT NULL DEFAULT 'unverified'
    CHECK (status = ANY (ARRAY['unverified'::text,'active'::text,'invalid'::text])),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payout_methods_user_idx ON public.payout_methods (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS payout_methods_one_default_per_user
  ON public.payout_methods (user_id) WHERE (is_default);
ALTER TABLE public.payout_methods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS payout_method_id uuid REFERENCES public.payout_methods(id);
