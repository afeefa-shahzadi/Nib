-- Add org_id to content_objects
ALTER TABLE public.content_objects ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Update RLS policies for content_objects to allow org members to read/write shared drafts
CREATE POLICY "Org members can view org drafts" ON public.content_objects
FOR SELECT
USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

CREATE POLICY "Org members can edit org drafts" ON public.content_objects
FOR UPDATE
USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

CREATE POLICY "Org members can insert org drafts" ON public.content_objects
FOR INSERT
WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));
