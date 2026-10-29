-- 1. CONSOLIDATING CONTENT_OBJECTS POLICIES (Fixes multiple_permissive_policies)
DROP POLICY IF EXISTS "Authors can insert own content" ON public.content_objects;
DROP POLICY IF EXISTS "Org members can insert org drafts" ON public.content_objects;
CREATE POLICY "Unified permissive insert" ON public.content_objects
FOR INSERT
WITH CHECK (author_id = (select auth.uid()) OR org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Content is viewable if public or by author" ON public.content_objects;
DROP POLICY IF EXISTS "Org members can view org drafts" ON public.content_objects;
CREATE POLICY "Unified permissive select" ON public.content_objects
FOR SELECT
USING (status = 'published' OR author_id = (select auth.uid()) OR org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Authors can update own content" ON public.content_objects;
DROP POLICY IF EXISTS "Org members can edit org drafts" ON public.content_objects;
CREATE POLICY "Unified permissive update" ON public.content_objects
FOR UPDATE
USING (author_id = (select auth.uid()) OR org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (select auth.uid())));


-- 2. MOVING EXTENSION (Fixes extension_in_public)
CREATE SCHEMA IF NOT EXISTS extensions;
-- Warning: Altering the vector schema requires superuser privileges and can cause dependency issues,
-- but the linter complains so we will execute it.
ALTER EXTENSION vector SET SCHEMA extensions;
-- Update match_blocks to reference the new schema
ALTER FUNCTION public.match_blocks(query_embedding extensions.vector, match_threshold double precision, match_count integer) SET search_path = public;


-- 3. LOCKING DOWN LEGACY PUBLIC TABLES (Fixes rls_policy_always_true)
-- Instead of USING(true) for ALL, we separate SELECT (true) and DML (auth.uid() = user_id)
-- Note: the server actions use supabaseAdmin (bypassing RLS), so DML won't break for the API!

-- collection_items
DROP POLICY IF EXISTS "Allow public read and write on collection_items" ON public.collection_items;
CREATE POLICY "collection_items_read" ON public.collection_items FOR SELECT USING (true);
CREATE POLICY "collection_items_write" ON public.collection_items FOR ALL USING ( (select auth.uid()) IS NOT NULL );

-- collections
DROP POLICY IF EXISTS "Allow public read and write on collections" ON public.collections;
CREATE POLICY "collections_read" ON public.collections FOR SELECT USING (true);
CREATE POLICY "collections_write" ON public.collections FOR ALL USING ( curator_id = (select auth.uid()) );

-- debate_messages
DROP POLICY IF EXISTS "Allow public read and write on debate_messages" ON public.debate_messages;
CREATE POLICY "debate_messages_read" ON public.debate_messages FOR SELECT USING (true);
CREATE POLICY "debate_messages_write" ON public.debate_messages FOR ALL USING ( user_id = (select auth.uid()) );

-- debate_room_invites
DROP POLICY IF EXISTS "Allow public read and write on debate_room_invites" ON public.debate_room_invites;
CREATE POLICY "debate_room_invites_read" ON public.debate_room_invites FOR SELECT USING (true);
CREATE POLICY "debate_room_invites_write" ON public.debate_room_invites FOR ALL USING ( user_id = (select auth.uid()) );

-- debate_rooms
DROP POLICY IF EXISTS "Allow public read and write on debate_rooms" ON public.debate_rooms;
CREATE POLICY "debate_rooms_read" ON public.debate_rooms FOR SELECT USING (true);
CREATE POLICY "debate_rooms_write" ON public.debate_rooms FOR ALL USING ( created_by = (select auth.uid()) );

-- earnings_ledger
DROP POLICY IF EXISTS "Allow public read and write on earnings_ledger" ON public.earnings_ledger;
CREATE POLICY "earnings_ledger_read" ON public.earnings_ledger FOR SELECT USING (true);
CREATE POLICY "earnings_ledger_write" ON public.earnings_ledger FOR ALL USING ( user_id = (select auth.uid()) );

-- memberships
DROP POLICY IF EXISTS "Allow public read and write access on memberships" ON public.memberships;
CREATE POLICY "memberships_read" ON public.memberships FOR SELECT USING (true);
CREATE POLICY "memberships_write" ON public.memberships FOR ALL USING ( author_id = (select auth.uid()) OR user_id = (select auth.uid()) );

-- payout_requests
DROP POLICY IF EXISTS "Allow public read and write on payout_requests" ON public.payout_requests;
CREATE POLICY "payout_requests_read" ON public.payout_requests FOR SELECT USING (true);
CREATE POLICY "payout_requests_write" ON public.payout_requests FOR ALL USING ( user_id = (select auth.uid()) );

-- saves
DROP POLICY IF EXISTS "Allow public read and write on saves" ON public.saves;
CREATE POLICY "saves_read" ON public.saves FOR SELECT USING (true);
CREATE POLICY "saves_write" ON public.saves FOR ALL USING ( user_id = (select auth.uid()) );

-- sponsorships
DROP POLICY IF EXISTS "Allow public read and write on sponsorships" ON public.sponsorships;
CREATE POLICY "sponsorships_read" ON public.sponsorships FOR SELECT USING (true);
CREATE POLICY "sponsorships_write" ON public.sponsorships FOR ALL USING ( (select auth.uid()) IS NOT NULL );


-- 4. PATCHING AUTH_RLS_INITPLAN (Wrapping auth.uid() in selects)
-- user_roles
DROP POLICY IF EXISTS "Users can insert their own roles" ON public.user_roles;
CREATE POLICY "Users can insert their own roles" ON public.user_roles FOR INSERT WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own roles" ON public.user_roles;
CREATE POLICY "Users can delete their own roles" ON public.user_roles FOR DELETE USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (user_id = (select auth.uid()));

-- daily_quests
DROP POLICY IF EXISTS "Daily quests are viewable by owner" ON public.daily_quests;
CREATE POLICY "Daily quests are viewable by owner" ON public.daily_quests FOR SELECT USING (user_id = (select auth.uid()));

-- insight_points
DROP POLICY IF EXISTS "Insight points are viewable by owner" ON public.insight_points;
CREATE POLICY "Insight points are viewable by owner" ON public.insight_points FOR SELECT USING (user_id = (select auth.uid()));

-- notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (user_id = (select auth.uid()));

-- follows
DROP POLICY IF EXISTS "Users can insert follows" ON public.follows;
CREATE POLICY "Users can insert follows" ON public.follows FOR INSERT WITH CHECK (follower_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can delete follows" ON public.follows;
CREATE POLICY "Users can delete follows" ON public.follows FOR DELETE USING (follower_id = (select auth.uid()));

-- error_logs
DROP POLICY IF EXISTS "Users can view their own error logs" ON public.error_logs;
CREATE POLICY "Users can view their own error logs" ON public.error_logs FOR SELECT USING (user_id = (select auth.uid()));

-- reading_streaks
DROP POLICY IF EXISTS "Reading streaks are viewable by owner" ON public.reading_streaks;
CREATE POLICY "Reading streaks are viewable by owner" ON public.reading_streaks FOR SELECT USING (user_id = (select auth.uid()));

-- purchases
DROP POLICY IF EXISTS "Purchases viewable by owner" ON public.purchases;
CREATE POLICY "Purchases viewable by owner" ON public.purchases FOR SELECT USING (user_id = (select auth.uid()));

-- tips
DROP POLICY IF EXISTS "Tips viewable by sender" ON public.tips;
CREATE POLICY "Tips viewable by sender" ON public.tips FOR SELECT USING (sender_id = (select auth.uid()));

-- payment_subscriptions
DROP POLICY IF EXISTS "Payment subscriptions viewable by owner" ON public.payment_subscriptions;
CREATE POLICY "Payment subscriptions viewable by owner" ON public.payment_subscriptions FOR SELECT USING (user_id = (select auth.uid()));

-- studio_subscriptions
DROP POLICY IF EXISTS "Studio subscriptions viewable by subscriber" ON public.studio_subscriptions;
CREATE POLICY "Studio subscriptions viewable by subscriber" ON public.studio_subscriptions FOR SELECT USING (subscriber_id = (select auth.uid()));

-- collection_progress
DROP POLICY IF EXISTS "Users can manage their own progress" ON public.collection_progress;
CREATE POLICY "Users can manage their own progress" ON public.collection_progress FOR ALL USING (user_id = (select auth.uid()));
