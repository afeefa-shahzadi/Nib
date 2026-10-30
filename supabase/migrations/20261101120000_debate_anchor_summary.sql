-- Debate responses can be tied to one paragraph of the piece; rooms can carry
-- a closing summary pinned by their creator.
alter table public.debate_messages
  add column if not exists block_id uuid references public.blocks(id) on delete set null;
create index if not exists debate_messages_block_id_idx on public.debate_messages(block_id);
alter table public.debate_rooms add column if not exists summary text;
