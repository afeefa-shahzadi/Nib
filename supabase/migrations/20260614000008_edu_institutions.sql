-- Migration: org_invites and org_workspaces for Educational Institutions

CREATE TABLE IF NOT EXISTS public.org_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.org_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read workspaces"
  ON public.org_workspaces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = org_workspaces.org_id
      AND org_members.user_id = (select auth.uid())
    )
  );


CREATE TABLE IF NOT EXISTS public.org_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.org_member_role DEFAULT 'member' NOT NULL,
  token UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (org_id, email)
);

ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can manage invites"
  ON public.org_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = org_invites.org_id
      AND org_members.user_id = (select auth.uid())
      AND org_members.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = org_invites.org_id
      AND org_members.user_id = (select auth.uid())
      AND org_members.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_org_workspaces_org_id ON public.org_workspaces(org_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_org_id ON public.org_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON public.org_invites(email);
