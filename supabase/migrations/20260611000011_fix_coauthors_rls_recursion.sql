-- Fix infinite recursion in piece_coauthors and content_objects policies

CREATE OR REPLACE FUNCTION public.is_piece_author(p_piece_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM content_objects 
    WHERE id = p_piece_id AND author_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_piece_coauthor(p_piece_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM piece_coauthors 
    WHERE piece_id = p_piece_id AND user_id = auth.uid()
  );
$$;

-- piece_coauthors policies
DROP POLICY IF EXISTS "Coauthors select" ON public.piece_coauthors;
CREATE POLICY "Coauthors select" ON public.piece_coauthors 
FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authors can manage coauthors" ON public.piece_coauthors;
CREATE POLICY "Authors can manage coauthors" ON public.piece_coauthors 
FOR ALL USING (
  public.is_piece_author(piece_id)
);

-- content_objects policies
DROP POLICY IF EXISTS "Authors and Coauthors can modify content" ON public.content_objects;
CREATE POLICY "Authors and Coauthors can modify content" ON public.content_objects 
FOR ALL USING (
  auth.uid() = author_id OR 
  public.is_piece_coauthor(id)
);
