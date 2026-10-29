-- Add collection_type to collections
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS collection_type TEXT DEFAULT 'list' CHECK (collection_type IN ('list', 'course', 'playbook'));

-- Add collection_progress table
CREATE TABLE IF NOT EXISTS public.collection_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    piece_id UUID REFERENCES public.content_objects(id) ON DELETE CASCADE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (collection_id, user_id, piece_id)
);

ALTER TABLE public.collection_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own progress" ON public.collection_progress FOR ALL USING (auth.uid() = user_id);
