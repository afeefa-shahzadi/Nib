-- Migration: minimum viable moderation (docs/moderation-plan.md §3)

-- Audit trail: every moderator takedown/dismiss/restore writes one row.
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id UUID NOT NULL REFERENCES public.profiles(id),
  content_object_id UUID REFERENCES public.content_objects(id),
  report_id UUID REFERENCES public.content_reports(id),
  action TEXT NOT NULL CHECK (action IN ('takedown_archived', 'takedown_deleted', 'dismissed', 'restored')),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Service-role only: RLS enabled with no policies.
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

-- Broaden reports beyond pieces: comments/profiles reportable via target_type/target_id.
-- content_object_id stays for backward compat (set to the piece where known).
ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS target_type TEXT CHECK (target_type IN ('piece', 'comment', 'profile')),
  ADD COLUMN IF NOT EXISTS target_id UUID;
