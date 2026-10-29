-- Guard C (Sec 194-O TDS): record the 1% withheld from each creator payout so
-- the quarterly return (Form 26Q) can be filed. Immutable audit rows — one per
-- settled payout. Rate/applicability need CA sign-off (see lib/tax.ts).
create table if not exists public.tds_withholdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  payout_id uuid not null references public.payout_requests(id),
  gross_paise integer not null,
  tds_paise integer not null,
  net_paise integer not null,
  quarter text not null,
  created_at timestamptz not null default now()
);

-- One withholding row per payout (settlePayout is gated once, but back this up).
create unique index if not exists tds_withholdings_payout_key
  on public.tds_withholdings (payout_id);
create index if not exists tds_withholdings_quarter_idx
  on public.tds_withholdings (quarter);

alter table public.tds_withholdings enable row level security;
-- No policy: service-role only (admin settle path). RLS on + no policy denies
-- all anon/authenticated access, same posture as restriction_appeals.
