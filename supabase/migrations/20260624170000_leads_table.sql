CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    organization_name TEXT NOT NULL,
    phone_number TEXT,
    intent TEXT NOT NULL, -- 'enterprise', 'education', etc.
    expected_seats TEXT,
    timeline TEXT,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'new', -- 'new', 'contacted', 'closed', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: We generally don't want leads to be viewable by the public,
-- but the server API will bypass RLS when inserting.
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
