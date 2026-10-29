-- Migration: Distribution & Growth Engine
-- Creates tables for the Creator Recommendation Network and Email Dispatch tracking

-- 1. RECOMMENDATIONS
CREATE TABLE IF NOT EXISTS public.recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    recommended_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    blurb TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (recommender_id, recommended_id)
);

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recommendations are viewable by everyone" ON public.recommendations FOR SELECT USING (true);
CREATE POLICY "Users can create their own recommendations" ON public.recommendations FOR INSERT WITH CHECK (auth.uid() = recommender_id);
CREATE POLICY "Users can delete their own recommendations" ON public.recommendations FOR DELETE USING (auth.uid() = recommender_id);

-- 2. NEWSLETTER DISPATCHES
CREATE TABLE IF NOT EXISTS public.newsletter_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    piece_id UUID REFERENCES public.content_objects(id) ON DELETE CASCADE NOT NULL,
    subject TEXT NOT NULL,
    recipient_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.newsletter_dispatches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own dispatches" ON public.newsletter_dispatches FOR SELECT USING (auth.uid() = author_id);
CREATE POLICY "Users can insert their own dispatches" ON public.newsletter_dispatches FOR INSERT WITH CHECK (auth.uid() = author_id);

-- 3. ANALYTICS (Update telemetry_events indices)
ALTER TABLE public.telemetry_events ADD COLUMN IF NOT EXISTS mode TEXT;
ALTER TABLE public.telemetry_events ADD COLUMN IF NOT EXISTS event TEXT DEFAULT 'view';
ALTER TABLE public.telemetry_events ADD COLUMN IF NOT EXISTS depth INTEGER;
ALTER TABLE public.telemetry_events ADD COLUMN IF NOT EXISTS session TEXT;
ALTER TABLE public.telemetry_events ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_telemetry_events_mode ON public.telemetry_events(mode);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_event ON public.telemetry_events(event);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_created_at ON public.telemetry_events(created_at);
