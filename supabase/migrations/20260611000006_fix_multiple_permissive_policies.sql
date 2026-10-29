-- Fix: Replace 'FOR ALL' policies with explicit INSERT, UPDATE, DELETE policies to prevent multiple permissive SELECT policies
-- collection_items
DROP POLICY IF EXISTS "collection_items_write" ON public.collection_items;
CREATE POLICY "collection_items_insert" ON public.collection_items FOR INSERT WITH CHECK ( (select auth.uid()) IS NOT NULL );
CREATE POLICY "collection_items_update" ON public.collection_items FOR UPDATE USING ( (select auth.uid()) IS NOT NULL );
CREATE POLICY "collection_items_delete" ON public.collection_items FOR DELETE USING ( (select auth.uid()) IS NOT NULL );

-- collections
DROP POLICY IF EXISTS "collections_write" ON public.collections;
CREATE POLICY "collections_insert" ON public.collections FOR INSERT WITH CHECK ( curator_id = (select auth.uid()) );
CREATE POLICY "collections_update" ON public.collections FOR UPDATE USING ( curator_id = (select auth.uid()) );
CREATE POLICY "collections_delete" ON public.collections FOR DELETE USING ( curator_id = (select auth.uid()) );

-- debate_messages
DROP POLICY IF EXISTS "debate_messages_write" ON public.debate_messages;
CREATE POLICY "debate_messages_insert" ON public.debate_messages FOR INSERT WITH CHECK ( user_id = (select auth.uid()) );
CREATE POLICY "debate_messages_update" ON public.debate_messages FOR UPDATE USING ( user_id = (select auth.uid()) );
CREATE POLICY "debate_messages_delete" ON public.debate_messages FOR DELETE USING ( user_id = (select auth.uid()) );

-- debate_room_invites
DROP POLICY IF EXISTS "debate_room_invites_write" ON public.debate_room_invites;
CREATE POLICY "debate_room_invites_insert" ON public.debate_room_invites FOR INSERT WITH CHECK ( user_id = (select auth.uid()) );
CREATE POLICY "debate_room_invites_update" ON public.debate_room_invites FOR UPDATE USING ( user_id = (select auth.uid()) );
CREATE POLICY "debate_room_invites_delete" ON public.debate_room_invites FOR DELETE USING ( user_id = (select auth.uid()) );

-- debate_rooms
DROP POLICY IF EXISTS "debate_rooms_write" ON public.debate_rooms;
CREATE POLICY "debate_rooms_insert" ON public.debate_rooms FOR INSERT WITH CHECK ( created_by = (select auth.uid()) );
CREATE POLICY "debate_rooms_update" ON public.debate_rooms FOR UPDATE USING ( created_by = (select auth.uid()) );
CREATE POLICY "debate_rooms_delete" ON public.debate_rooms FOR DELETE USING ( created_by = (select auth.uid()) );

-- earnings_ledger
DROP POLICY IF EXISTS "earnings_ledger_write" ON public.earnings_ledger;
CREATE POLICY "earnings_ledger_insert" ON public.earnings_ledger FOR INSERT WITH CHECK ( user_id = (select auth.uid()) );
CREATE POLICY "earnings_ledger_update" ON public.earnings_ledger FOR UPDATE USING ( user_id = (select auth.uid()) );
CREATE POLICY "earnings_ledger_delete" ON public.earnings_ledger FOR DELETE USING ( user_id = (select auth.uid()) );

-- memberships
DROP POLICY IF EXISTS "memberships_write" ON public.memberships;
CREATE POLICY "memberships_insert" ON public.memberships FOR INSERT WITH CHECK ( author_id = (select auth.uid()) OR user_id = (select auth.uid()) );
CREATE POLICY "memberships_update" ON public.memberships FOR UPDATE USING ( author_id = (select auth.uid()) OR user_id = (select auth.uid()) );
CREATE POLICY "memberships_delete" ON public.memberships FOR DELETE USING ( author_id = (select auth.uid()) OR user_id = (select auth.uid()) );

-- payout_requests
DROP POLICY IF EXISTS "payout_requests_write" ON public.payout_requests;
CREATE POLICY "payout_requests_insert" ON public.payout_requests FOR INSERT WITH CHECK ( user_id = (select auth.uid()) );
CREATE POLICY "payout_requests_update" ON public.payout_requests FOR UPDATE USING ( user_id = (select auth.uid()) );
CREATE POLICY "payout_requests_delete" ON public.payout_requests FOR DELETE USING ( user_id = (select auth.uid()) );

-- saves
DROP POLICY IF EXISTS "saves_write" ON public.saves;
CREATE POLICY "saves_insert" ON public.saves FOR INSERT WITH CHECK ( user_id = (select auth.uid()) );
CREATE POLICY "saves_update" ON public.saves FOR UPDATE USING ( user_id = (select auth.uid()) );
CREATE POLICY "saves_delete" ON public.saves FOR DELETE USING ( user_id = (select auth.uid()) );

-- sponsorships
DROP POLICY IF EXISTS "sponsorships_write" ON public.sponsorships;
CREATE POLICY "sponsorships_insert" ON public.sponsorships FOR INSERT WITH CHECK ( (select auth.uid()) IS NOT NULL );
CREATE POLICY "sponsorships_update" ON public.sponsorships FOR UPDATE USING ( (select auth.uid()) IS NOT NULL );
CREATE POLICY "sponsorships_delete" ON public.sponsorships FOR DELETE USING ( (select auth.uid()) IS NOT NULL );
