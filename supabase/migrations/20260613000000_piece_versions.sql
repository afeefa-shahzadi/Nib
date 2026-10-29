create table if not exists public.piece_versions (
    id uuid default gen_random_uuid() primary key,
    piece_id uuid not null references public.content_objects(id) on delete cascade,
    author_id uuid not null references auth.users(id) on delete cascade,
    message text,
    is_auto boolean default false,
    blocks_snapshot jsonb not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists piece_versions_piece_id_idx on public.piece_versions(piece_id);
create index if not exists piece_versions_author_id_idx on public.piece_versions(author_id);

alter table public.piece_versions enable row level security;

create policy "Users can view versions of pieces they own"
    on public.piece_versions for select
    using (
        author_id = auth.uid() 
        or 
        piece_id in (
            select piece_id from public.piece_coauthors where user_id = auth.uid()
        )
    );

create policy "Users can create versions of pieces they own"
    on public.piece_versions for insert
    with check (
        author_id = auth.uid()
        or 
        piece_id in (
            select piece_id from public.piece_coauthors where user_id = auth.uid()
        )
    );

create policy "Users can delete their own versions"
    on public.piece_versions for delete
    using (author_id = auth.uid());
