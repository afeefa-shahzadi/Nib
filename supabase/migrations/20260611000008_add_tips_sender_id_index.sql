-- Fix unindexed_foreign_keys for tips.sender_id
CREATE INDEX IF NOT EXISTS idx_tips_sender_id ON public.tips(sender_id);
