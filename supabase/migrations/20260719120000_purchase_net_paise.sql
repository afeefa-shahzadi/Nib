-- Guard B (chargeback clawback): store the net credited to the creator at
-- settlement so a later refund/dispute reverses the EXACT amount. Fee rules
-- are GMV-dependent (Studio 0%/5% tiers), so the net cannot be recomputed
-- reliably after the fact.
alter table public.purchases add column if not exists net_paise integer;
