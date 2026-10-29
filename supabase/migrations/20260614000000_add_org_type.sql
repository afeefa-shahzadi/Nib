ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'standard' CHECK (type IN ('standard', 'educational_institution', 'business'));
