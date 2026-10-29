CREATE TABLE IF NOT EXISTS public.reader_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    razorpay_subscription_id TEXT NOT NULL UNIQUE,
    razorpay_plan_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'created',
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.reader_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reader subscriptions viewable by user" 
ON public.reader_subscriptions FOR SELECT 
USING (user_id = (select auth.uid()));
