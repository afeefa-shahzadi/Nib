-- Fix database linter warnings: auth_rls_initplan, multiple_permissive_policies, and security_definer_function_executable

-- 1. Move SECURITY DEFINER functions to a private schema to avoid exposing them via PostgREST
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_piece_author(p_piece_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.content_objects 
    WHERE id = p_piece_id AND author_id = (select auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION private.is_piece_coauthor(p_piece_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.piece_coauthors 
    WHERE piece_id = p_piece_id AND user_id = (select auth.uid())
  );
$$;

-- Drop the old public functions
DROP FUNCTION IF EXISTS public.is_piece_author(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_piece_coauthor(UUID) CASCADE;

-- 2. Fix multiple_permissive_policies on piece_coauthors and content_objects
-- Drop old coauthors policies
DROP POLICY IF EXISTS "Coauthors select" ON public.piece_coauthors;
DROP POLICY IF EXISTS "Authors can manage coauthors" ON public.piece_coauthors;

-- Recreate piece_coauthors with single policies per action, and fix auth_rls_initplan by using (select auth.uid())
CREATE POLICY "piece_coauthors_select" ON public.piece_coauthors FOR SELECT USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "piece_coauthors_insert" ON public.piece_coauthors FOR INSERT WITH CHECK (private.is_piece_author(piece_id));
CREATE POLICY "piece_coauthors_update" ON public.piece_coauthors FOR UPDATE USING (private.is_piece_author(piece_id));
CREATE POLICY "piece_coauthors_delete" ON public.piece_coauthors FOR DELETE USING (private.is_piece_author(piece_id));

-- Drop old content_objects policies to unify them
DROP POLICY IF EXISTS "Authors and Coauthors can modify content" ON public.content_objects;
DROP POLICY IF EXISTS "Unified permissive update" ON public.content_objects;

-- Recreate Unified permissive update to include coauthors, fixing multiple_permissive_policies and auth_rls_initplan
CREATE POLICY "Unified permissive update" ON public.content_objects
FOR UPDATE
USING (
  author_id = (select auth.uid()) OR 
  org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (select auth.uid())) OR
  private.is_piece_coauthor(id)
);
