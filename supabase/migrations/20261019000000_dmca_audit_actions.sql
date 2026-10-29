-- DMCA disable/restore write to the shared moderation_actions audit log, but the
-- action CHECK didn't include their values, so those audit inserts silently
-- failed (caught in E2E — the unit-test fakes don't enforce CHECK constraints).
-- Add the two DMCA actions so the legal audit trail is actually recorded, and
-- kept distinct from generic moderation takedowns.
ALTER TABLE public.moderation_actions
  DROP CONSTRAINT moderation_actions_action_check;
ALTER TABLE public.moderation_actions
  ADD CONSTRAINT moderation_actions_action_check CHECK (
    action = ANY (ARRAY[
      'takedown_archived'::text,
      'takedown_deleted'::text,
      'dismissed'::text,
      'restored'::text,
      'strike'::text,
      'restriction_lifted'::text,
      'dmca_disable'::text,
      'dmca_restore'::text
    ])
  );
