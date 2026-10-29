-- Add date_of_birth to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Add is_nsfw to blocks for block-level age gating
ALTER TABLE public.blocks ADD COLUMN IF NOT EXISTS is_nsfw BOOLEAN DEFAULT false;

-- Ensure piece_responses exists before altering
CREATE TABLE IF NOT EXISTS public.piece_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    piece_id UUID REFERENCES public.content_objects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Update piece_responses to support nested threaded replies
ALTER TABLE public.piece_responses ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.piece_responses(id) ON DELETE CASCADE;

-- Add index on parent_id for faster recursive queries
CREATE INDEX IF NOT EXISTS piece_responses_parent_id_idx ON public.piece_responses(parent_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, handle, avatar_url, bio, date_of_birth)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'display_name', new.email),
        COALESCE(new.raw_user_meta_data->>'handle', 'user_' || substr(new.id::text, 1, 8)),
        new.raw_user_meta_data->>'avatar_url',
        new.raw_user_meta_data->>'bio',
        (new.raw_user_meta_data->>'date_of_birth')::DATE
    )
    ON CONFLICT (id) DO NOTHING;
    
    IF new.raw_user_meta_data->>'role' IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (new.id, new.raw_user_meta_data->>'role')
        ON CONFLICT (user_id, role) DO NOTHING;
        
        -- If role is organization, create an organization automatically
        IF new.raw_user_meta_data->>'role' = 'organization' THEN
            INSERT INTO public.organizations (slug, name, type, owner_id)
            VALUES (
                COALESCE(new.raw_user_meta_data->>'handle', 'org_' || substr(new.id::text, 1, 8)),
                COALESCE(new.raw_user_meta_data->>'org_name', COALESCE(new.raw_user_meta_data->>'display_name', 'My Organization')),
                COALESCE(new.raw_user_meta_data->>'org_type', 'educational_institution'),
                new.id
            )
            ON CONFLICT (slug) DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
