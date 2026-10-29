-- 1. Fix rls_enabled_no_policy on org_invites
CREATE POLICY "org_invites_read" ON public.org_invites FOR SELECT USING (true);
CREATE POLICY "org_invites_insert" ON public.org_invites FOR INSERT WITH CHECK ( (select auth.uid()) IS NOT NULL );
CREATE POLICY "org_invites_update" ON public.org_invites FOR UPDATE USING ( (select auth.uid()) IS NOT NULL );
CREATE POLICY "org_invites_delete" ON public.org_invites FOR DELETE USING ( (select auth.uid()) IS NOT NULL );

-- 2. Fix unindexed_foreign_keys for all tables flagged

-- boosts
CREATE INDEX IF NOT EXISTS idx_boosts_author_id ON public.boosts(author_id);
CREATE INDEX IF NOT EXISTS idx_boosts_content_object_id ON public.boosts(content_object_id);
CREATE INDEX IF NOT EXISTS idx_boosts_piece_id ON public.boosts(piece_id);
CREATE INDEX IF NOT EXISTS idx_boosts_sender_id ON public.boosts(sender_id);

-- branches
CREATE INDEX IF NOT EXISTS idx_branches_parent_object_id ON public.branches(parent_object_id);

-- bundles
CREATE INDEX IF NOT EXISTS idx_bundles_author_id ON public.bundles(author_id);

-- collection_items
CREATE INDEX IF NOT EXISTS idx_collection_items_collection_id ON public.collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_content_object_id ON public.collection_items(content_object_id);

-- collection_progress
CREATE INDEX IF NOT EXISTS idx_collection_progress_piece_id ON public.collection_progress(piece_id);
CREATE INDEX IF NOT EXISTS idx_collection_progress_user_id ON public.collection_progress(user_id);

-- collections
CREATE INDEX IF NOT EXISTS idx_collections_curator_id ON public.collections(curator_id);

-- content_objects
CREATE INDEX IF NOT EXISTS idx_content_objects_org_id ON public.content_objects(org_id);

-- daily_quests
CREATE INDEX IF NOT EXISTS idx_daily_quests_user_id ON public.daily_quests(user_id);

-- debate_messages
CREATE INDEX IF NOT EXISTS idx_debate_messages_room_id ON public.debate_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_debate_messages_user_id ON public.debate_messages(user_id);

-- debate_room_invites
CREATE INDEX IF NOT EXISTS idx_debate_room_invites_room_id ON public.debate_room_invites(room_id);
CREATE INDEX IF NOT EXISTS idx_debate_room_invites_user_id ON public.debate_room_invites(user_id);

-- debate_rooms
CREATE INDEX IF NOT EXISTS idx_debate_rooms_branch_id ON public.debate_rooms(branch_id);
CREATE INDEX IF NOT EXISTS idx_debate_rooms_content_object_id ON public.debate_rooms(content_object_id);
CREATE INDEX IF NOT EXISTS idx_debate_rooms_created_by ON public.debate_rooms(created_by);
CREATE INDEX IF NOT EXISTS idx_debate_rooms_org_id ON public.debate_rooms(org_id);
CREATE INDEX IF NOT EXISTS idx_debate_rooms_required_tier_id ON public.debate_rooms(required_tier_id);

-- earnings_ledger
CREATE INDEX IF NOT EXISTS idx_earnings_ledger_user_id ON public.earnings_ledger(user_id);

-- error_logs
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs(user_id);

-- follows
CREATE INDEX IF NOT EXISTS idx_follows_author_id ON public.follows(author_id);

-- insight_points
CREATE INDEX IF NOT EXISTS idx_insight_points_user_id ON public.insight_points(user_id);

-- membership_tiers
CREATE INDEX IF NOT EXISTS idx_membership_tiers_author_id ON public.membership_tiers(author_id);

-- memberships
CREATE INDEX IF NOT EXISTS idx_memberships_author_id ON public.memberships(author_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tier_id ON public.memberships(tier_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.memberships(user_id);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- org_invites
CREATE INDEX IF NOT EXISTS idx_org_invites_org_id ON public.org_invites(org_id);

-- org_members
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.org_members(user_id);

-- org_subscriptions
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_org_id ON public.org_subscriptions(org_id);

-- organizations
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON public.organizations(owner_id);

-- payment_subscriptions
CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_author_id ON public.payment_subscriptions(author_id);
CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_user_id ON public.payment_subscriptions(user_id);

-- payout_requests
CREATE INDEX IF NOT EXISTS idx_payout_requests_user_id ON public.payout_requests(user_id);

-- purchases
CREATE INDEX IF NOT EXISTS idx_purchases_author_id ON public.purchases(author_id);
CREATE INDEX IF NOT EXISTS idx_purchases_bundle_id ON public.purchases(bundle_id);
CREATE INDEX IF NOT EXISTS idx_purchases_content_object_id ON public.purchases(content_object_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON public.purchases(user_id);

-- relationships
CREATE INDEX IF NOT EXISTS idx_relationships_from_object_id ON public.relationships(from_object_id);
CREATE INDEX IF NOT EXISTS idx_relationships_to_object_id ON public.relationships(to_object_id);

-- saves
CREATE INDEX IF NOT EXISTS idx_saves_collection_id ON public.saves(collection_id);
CREATE INDEX IF NOT EXISTS idx_saves_content_object_id ON public.saves(content_object_id);
CREATE INDEX IF NOT EXISTS idx_saves_user_id ON public.saves(user_id);

-- sponsorships
CREATE INDEX IF NOT EXISTS idx_sponsorships_content_object_id ON public.sponsorships(content_object_id);

-- studio_subscriptions
CREATE INDEX IF NOT EXISTS idx_studio_subscriptions_subscriber_id ON public.studio_subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_studio_subscriptions_tier_id ON public.studio_subscriptions(tier_id);

-- tips
CREATE INDEX IF NOT EXISTS idx_tips_author_id ON public.tips(author_id);
CREATE INDEX IF NOT EXISTS idx_tips_recipient_id ON public.tips(recipient_id);
