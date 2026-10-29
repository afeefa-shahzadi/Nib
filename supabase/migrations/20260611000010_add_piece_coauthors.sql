-- Add piece_coauthors table and update RLS policies for co-authoring

CREATE TABLE IF NOT EXISTS public.piece_coauthors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    piece_id UUID REFERENCES public.content_objects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL DEFAULT 'coauthor',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (piece_id, user_id)
);

-- RLS for piece_coauthors
ALTER TABLE public.piece_coauthors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coauthors select" ON public.piece_coauthors 
FOR SELECT USING (
  user_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.content_objects WHERE id = piece_id AND author_id = auth.uid())
);

CREATE POLICY "Authors can manage coauthors" ON public.piece_coauthors 
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.content_objects WHERE id = piece_id AND author_id = auth.uid())
);

-- Drop old content_objects update policy if it exists, replace with co-author aware policy
DROP POLICY IF EXISTS "Authors can modify own content" ON public.content_objects;

CREATE POLICY "Authors and Coauthors can modify content" ON public.content_objects 
FOR ALL USING (
  auth.uid() = author_id OR 
  EXISTS (SELECT 1 FROM public.piece_coauthors WHERE piece_id = id AND user_id = auth.uid())
);

-- Create index for quick co-author lookups
CREATE INDEX IF NOT EXISTS idx_piece_coauthors_piece_id ON public.piece_coauthors(piece_id);
CREATE INDEX IF NOT EXISTS idx_piece_coauthors_user_id ON public.piece_coauthors(user_id);
