-- Membership checkout writes tier_id and razorpay_plan_id and the webhook
-- writes current_period_end, but none of these columns existed, so every
-- membership checkout failed. Memberships also had no link to the
-- subscription that pays for them, so nothing could open or close one.
alter table public.payment_subscriptions
  add column if not exists tier_id uuid references public.membership_tiers(id) on delete set null,
  add column if not exists razorpay_plan_id text,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false;

alter table public.memberships
  add column if not exists payment_subscription_id uuid references public.payment_subscriptions(id) on delete set null;

create unique index if not exists memberships_payment_subscription_id_key
  on public.memberships (payment_subscription_id);
