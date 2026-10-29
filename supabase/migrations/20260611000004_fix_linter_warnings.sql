-- Fix: Enable RLS on org_invites
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

-- Fix: Set search_path for functions to prevent search_path mutability vulnerability
ALTER FUNCTION public.match_blocks(query_embedding vector, match_threshold double precision, match_count integer) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- Fix: Prevent anon/authenticated users from executing handle_new_user via RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- Fix: auth_rls_initplan for the new content_objects policies we just created
DROP POLICY IF EXISTS "Org members can view org drafts" ON public.content_objects;
CREATE POLICY "Org members can view org drafts" ON public.content_objects
FOR SELECT
USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Org members can edit org drafts" ON public.content_objects;
CREATE POLICY "Org members can edit org drafts" ON public.content_objects
FOR UPDATE
USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Org members can insert org drafts" ON public.content_objects;
CREATE POLICY "Org members can insert org drafts" ON public.content_objects
FOR INSERT
WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (select auth.uid())));
