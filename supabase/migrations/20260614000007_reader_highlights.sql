-- Migration: reader highlights and annotations

CREATE TABLE IF NOT EXISTS public.reader_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id UUID NOT NULL REFERENCES public.content_objects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text_content TEXT NOT NULL,
  block_id TEXT, -- optional: if we can anchor it to a specific block
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.reader_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own highlights"
  ON public.reader_highlights FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_highlights_piece_id ON public.reader_highlights(piece_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user_id ON public.reader_highlights(user_id);


CREATE TABLE IF NOT EXISTS public.reader_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id UUID NOT NULL REFERENCES public.reader_highlights(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.reader_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own annotations"
  ON public.reader_annotations FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_annotations_highlight_id ON public.reader_annotations(highlight_id);
