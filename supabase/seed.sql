-- Seed Data for Nib

-- 1. Insert seed profiles (referenced by user accounts)
INSERT INTO public.profiles (id, handle, display_name, bio)
VALUES 
    ('d2b78a9c-0e24-4fbb-88a4-0ef6be2f7e01', 'alice', 'Alice Vance', 'Fascinated by decentralized computing and visual design. Early writer on Nib.'),
    ('e9c8928d-1901-4ac3-b248-be22fb11a5c2', 'bob', 'Bob Miller', 'Pedagogical design researcher. Writing about complex systems and cognitive science.')
ON CONFLICT (id) DO NOTHING;

-- 2. Insert membership tiers for Alice
INSERT INTO public.membership_tiers (id, author_id, name, description, price_cents, perks)
VALUES 
    ('a111a111-2222-3333-4444-555555555555', 'd2b78a9c-0e24-4fbb-88a4-0ef6be2f7e01', 'Deep Thinker', 'Access to premium expert annotations and monthly branch updates.', 500, ARRAY['Premium articles', 'Expert mode annotation access'])
ON CONFLICT (id) DO NOTHING;

-- 3. Insert content objects
INSERT INTO public.content_objects (id, author_id, title, slug, summary, canonical_thesis, status, visibility, published_at)
VALUES 
    ('c111c111-2222-3333-4444-555555555555', 'd2b78a9c-0e24-4fbb-88a4-0ef6be2f7e01', 'The Architecture of Decentralized Thought', 'decentralized-thought', 'An exploration of how distributed networks mirror cognitive systems.', 'True distribution of intelligence requires node-level consensus rather than centralized hubs.', 'published', 'public', now())
ON CONFLICT (id) DO NOTHING;

-- 4. Insert content blocks for the piece
INSERT INTO public.blocks (id, content_object_id, type, content, semantic_role, display_priority, mode_visibility, order)
VALUES 
    ('b111b111-2222-3333-4444-555555555555', 'c111c111-2222-3333-4444-555555555555', 'heading', '{"text": "Introduction to Network Intelligence"}', 'heading', 1, '["skim", "standard", "expert", "teach"]', 0),
    ('b222b222-2222-3333-4444-555555555555', 'c111c111-2222-3333-4444-555555555555', 'paragraph', '{"text": "Modern computing platforms have long favored central hubs. However, decentralized mycelial networks show us that intelligence can flourish dynamically without a single point of failure."}', 'claim', 0, '["skim", "standard", "expert", "teach"]', 1),
    ('b333b333-2222-3333-4444-555555555555', 'c111c111-2222-3333-4444-555555555555', 'callout', '{"text": "Key Concept: Distributed consensus algorithms are the digital equivalent of chemical signaling in fungal colonies."}', 'teaching', 0, '["expert", "teach"]', 2)
ON CONFLICT (id) DO NOTHING;
