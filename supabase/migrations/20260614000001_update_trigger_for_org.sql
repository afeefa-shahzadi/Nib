CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, handle, avatar_url, bio)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'display_name', new.email),
        COALESCE(new.raw_user_meta_data->>'handle', 'user_' || substr(new.id::text, 1, 8)),
        new.raw_user_meta_data->>'avatar_url',
        new.raw_user_meta_data->>'bio'
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
