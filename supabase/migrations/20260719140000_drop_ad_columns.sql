-- Drop the dead advertising columns on profiles. Mycelium promises "never run
-- display ads" (lib/content/pricing/data.ts), and nothing reads or writes these
-- — no ads feature was ever built. Dropping a column also drops its column-level
-- GRANTs, so the anon/authenticated SELECT grants on ads_opt_in /
-- ads_preferred_domains go with them; no separate REVOKE needed.
alter table public.profiles
  drop column if exists ads_opt_in,
  drop column if exists ads_preferred_domains,
  drop column if exists ad_revenue_balance_cents,
  drop column if exists ad_impressions_count,
  drop column if exists ad_earnings_total_cents;
