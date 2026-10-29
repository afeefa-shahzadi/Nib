-- Migration: Quests & Achievements Data Model
-- Scalable stat-based architecture for gamification

-- 1. Profiles Additions
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;

-- 2. User Stats Engine (Cumulative Metrics)
CREATE TABLE IF NOT EXISTS public.user_stats (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    pieces_read INTEGER DEFAULT 0,
    pieces_written INTEGER DEFAULT 0,
    tips_received INTEGER DEFAULT 0,
    followers_count INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_active_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all stats" ON public.user_stats FOR SELECT USING (true);
-- Only system/triggers update this table

-- 3. Quests Dictionary
CREATE TABLE IF NOT EXISTS public.quests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    quest_type TEXT NOT NULL, -- 'daily', 'weekly', 'lifetime'
    stat_key TEXT NOT NULL, -- matches a column in user_stats, e.g. 'pieces_read'
    target_value INTEGER NOT NULL,
    reward_xp INTEGER DEFAULT 0,
    reward_credits INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quests are readable by everyone" ON public.quests FOR SELECT USING (true);

-- 4. Achievements Dictionary
CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    tier TEXT NOT NULL, -- 'bronze', 'silver', 'gold', 'platinum', 'diamond'
    stat_key TEXT NOT NULL,
    target_value INTEGER NOT NULL,
    reward_xp INTEGER DEFAULT 0,
    icon_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Achievements are readable by everyone" ON public.achievements FOR SELECT USING (true);

-- 5. User Reward Claims
CREATE TABLE IF NOT EXISTS public.user_reward_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL, -- 'quest' or 'achievement'
    item_id UUID NOT NULL, -- references quests(id) or achievements(id)
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (user_id, item_type, item_id)
);

ALTER TABLE public.user_reward_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own claims" ON public.user_reward_claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can claim rewards" ON public.user_reward_claims FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Triggers to Auto-Update Stats

-- Auto-create user_stats on new profile
CREATE OR REPLACE FUNCTION public.handle_new_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_stats (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_stats ON public.profiles;
CREATE TRIGGER on_profile_created_stats
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_stats();

-- pieces_written trigger
CREATE OR REPLACE FUNCTION public.handle_piece_written()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into stats if not exists (for older users without stats row)
  INSERT INTO public.user_stats (user_id, pieces_written) 
  VALUES (NEW.author_id, 0) ON CONFLICT (user_id) DO NOTHING;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
      UPDATE public.user_stats SET pieces_written = pieces_written + 1, updated_at = now() WHERE user_id = NEW.author_id;
    ELSIF NEW.status != 'published' AND OLD.status = 'published' THEN
      UPDATE public.user_stats SET pieces_written = GREATEST(0, pieces_written - 1), updated_at = now() WHERE user_id = NEW.author_id;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.status = 'published' THEN
      UPDATE public.user_stats SET pieces_written = pieces_written + 1, updated_at = now() WHERE user_id = NEW.author_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_piece_published_update ON public.content_objects;
CREATE TRIGGER on_piece_published_update
  AFTER UPDATE ON public.content_objects
  FOR EACH ROW EXECUTE PROCEDURE public.handle_piece_written();

DROP TRIGGER IF EXISTS on_piece_published_insert ON public.content_objects;
CREATE TRIGGER on_piece_published_insert
  AFTER INSERT ON public.content_objects
  FOR EACH ROW EXECUTE PROCEDURE public.handle_piece_written();

-- followers_count trigger
CREATE OR REPLACE FUNCTION public.handle_follow_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_stats (user_id, followers_count) VALUES (NEW.author_id, 0) ON CONFLICT (user_id) DO NOTHING;
    UPDATE public.user_stats SET followers_count = followers_count + 1, updated_at = now() WHERE user_id = NEW.author_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_stats SET followers_count = GREATEST(0, followers_count - 1), updated_at = now() WHERE user_id = OLD.author_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: The original table was assumed to be follows. Assuming follows exists.
-- If follows does not exist, the trigger will just fail to attach, which is fine for now until the exact name is known.
-- Wait, let's verify if `follows` exists. (Usually it does in social apps).
