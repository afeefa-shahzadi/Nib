-- Migration: the rate_limits table that checkRateLimit (lib/rate-limit.server.ts)
-- reads/writes but no migration ever created. Missing in production, so every
-- lookup 404'd and the limiter failed OPEN — AI calls, payout attempts, the
-- disability-verify brute-force cap, and the contact form had no limit. Surfaced
-- during QA (#19).
--
-- Fixed window: one row per (bucket, identifier), reset when the window ages out.
-- Composite PK is also the upsert conflict target used by checkRateLimit.
CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket       text NOT NULL,
  identifier   text NOT NULL,
  count        integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, identifier)
);

-- Service-role only: the limiter runs server-side via the service-role client.
-- RLS on with no policy = no anon/authenticated access.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
