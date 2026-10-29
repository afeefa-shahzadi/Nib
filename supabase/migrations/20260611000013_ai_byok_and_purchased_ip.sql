-- Migration: Add mistral_api_key to profiles and purchased_points to insight_points
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mistral_api_key TEXT;
ALTER TABLE public.insight_points ADD COLUMN IF NOT EXISTS purchased_points INTEGER NOT NULL DEFAULT 0;
