


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "drizzle";


ALTER SCHEMA "drizzle" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";






CREATE TYPE "public"."block_type" AS ENUM (
    'paragraph',
    'heading',
    'citation',
    'code',
    'chart',
    'image',
    'callout',
    'question',
    'exercise',
    'discussion_anchor',
    'audio_note',
    'embed',
    'quote',
    'mermaid',
    'flowchart'
);


ALTER TYPE "public"."block_type" OWNER TO "postgres";


CREATE TYPE "public"."branch_type" AS ENUM (
    'audio',
    'teach',
    'premium_update',
    'debate',
    'localized'
);


ALTER TYPE "public"."branch_type" OWNER TO "postgres";


CREATE TYPE "public"."content_status" AS ENUM (
    'draft',
    'scheduled',
    'published',
    'archived',
    'deleted'
);


ALTER TYPE "public"."content_status" OWNER TO "postgres";


CREATE TYPE "public"."relationship_type" AS ENUM (
    'supports',
    'expands',
    'rebuts',
    'derives_from',
    'teaches',
    'included_in_bundle',
    'discussed_in'
);


ALTER TYPE "public"."relationship_type" OWNER TO "postgres";


CREATE TYPE "public"."visibility" AS ENUM (
    'public',
    'members_only',
    'private',
    'cohort'
);


ALTER TYPE "public"."visibility" OWNER TO "postgres";


CREATE TYPE "public"."workspace_role" AS ENUM (
    'owner',
    'editor',
    'contributor',
    'reviewer'
);


ALTER TYPE "public"."workspace_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_piece_author"("p_piece_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.content_objects 
    WHERE id = p_piece_id AND author_id = (select auth.uid())
  );
$$;


ALTER FUNCTION "private"."is_piece_author"("p_piece_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_piece_coauthor"("p_piece_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.piece_coauthors 
    WHERE piece_id = p_piece_id AND user_id = (select auth.uid())
  );
$$;


ALTER FUNCTION "private"."is_piece_coauthor"("p_piece_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_follow_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_stats (user_id, followers_count) VALUES (NEW.author_id, 0) ON CONFLICT (user_id) DO NOTHING;
    UPDATE public.user_stats SET followers_count = followers_count + 1, updated_at = now() WHERE user_id = NEW.author_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_stats SET followers_count = GREATEST(0, followers_count - 1), updated_at = now() WHERE user_id = OLD.author_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."handle_follow_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.user_stats (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_piece_written"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Insert into stats if not exists (for older users without stats row)
  INSERT INTO public.user_stats (user_id, pieces_written) 
  VALUES (NEW.author_id, 0) ON CONFLICT (user_id) DO NOTHING;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
      UPDATE public.user_stats SET pieces_written = pieces_written + 1, updated_at = now() WHERE user_id = NEW.author_id;
    ELSIF NEW.status != 'published' AND OLD.status = 'published' THEN
      UPDATE public.user_stats SET pieces_written = GREATEST(0, pieces_written - 1), updated_at = now() WHERE user_id = NEW.author_id;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.status = 'published' THEN
      UPDATE public.user_stats SET pieces_written = pieces_written + 1, updated_at = now() WHERE user_id = NEW.author_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_piece_written"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_blocks"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) RETURNS TABLE("id" "uuid", "content_object_id" "uuid", "type" "text", "content" "jsonb", "similarity" double precision)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    blocks.id,
    blocks.content_object_id,
    blocks.type,
    blocks.content,
    1 - (blocks.embedding <=> query_embedding) AS similarity
  FROM blocks
  WHERE 1 - (blocks.embedding <=> query_embedding) > match_threshold
  ORDER BY blocks.embedding <=> query_embedding
  LIMIT match_count;
$$;


ALTER FUNCTION "public"."match_blocks"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
    "id" integer NOT NULL,
    "hash" "text" NOT NULL,
    "created_at" bigint
);


ALTER TABLE "drizzle"."__drizzle_migrations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "drizzle"."__drizzle_migrations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "drizzle"."__drizzle_migrations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "drizzle"."__drizzle_migrations_id_seq" OWNED BY "drizzle"."__drizzle_migrations"."id";



CREATE TABLE IF NOT EXISTS "public"."achievements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "tier" "text" NOT NULL,
    "stat_key" "text" NOT NULL,
    "target_value" integer NOT NULL,
    "reward_xp" integer DEFAULT 0,
    "icon_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."achievements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ad_payout_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount_cents" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ad_payout_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."author_subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "subscriber_email" "text" NOT NULL,
    "subscriber_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."author_subscribers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_object_id" "uuid" NOT NULL,
    "type" "public"."block_type" DEFAULT 'paragraph'::"public"."block_type" NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "semantic_role" "text",
    "display_priority" integer DEFAULT 1,
    "mode_visibility" "jsonb" DEFAULT '{}'::"jsonb",
    "monetization_eligible" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "embedding" "extensions"."vector"(1024),
    "is_nsfw" boolean DEFAULT false,
    "sources" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."boosts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid",
    "piece_id" "uuid" NOT NULL,
    "amount_paise" integer NOT NULL,
    "razorpay_order_id" "text" NOT NULL,
    "razorpay_payment_id" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "author_id" "uuid",
    "content_object_id" "uuid",
    "duration_hours" integer DEFAULT 0,
    "annotator_pool_paise" integer DEFAULT 0,
    "status" "text" DEFAULT 'active'::"text",
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone
);


ALTER TABLE "public"."boosts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branch_merge_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "reviewer_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "conflict_details" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."branch_merge_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_content_object_id" "uuid" NOT NULL,
    "type" "public"."branch_type" NOT NULL,
    "purpose" "text",
    "visibility" "public"."visibility" DEFAULT 'private'::"public"."visibility" NOT NULL,
    "status" "public"."content_status" DEFAULT 'draft'::"public"."content_status" NOT NULL,
    "derived_changes_summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_object_id" "uuid",
    "branch_type" "text",
    "state" "text",
    "summary" "text"
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bundle_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bundle_id" "uuid" NOT NULL,
    "content_object_id" "uuid",
    "branch_id" "uuid",
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bundle_items_one_target" CHECK ((("content_object_id" IS NOT NULL) <> ("branch_id" IS NOT NULL)))
);


ALTER TABLE "public"."bundle_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bundle_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "bundle_id" "uuid" NOT NULL,
    "stripe_session_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bundle_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bundles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "outcome_statement" "text",
    "price" integer DEFAULT 0 NOT NULL,
    "visibility" "public"."visibility" DEFAULT 'public'::"public"."visibility" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "author_id" "uuid"
);


ALTER TABLE "public"."bundles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collection_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "collection_id" "uuid",
    "content_object_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."collection_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collection_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "collection_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "piece_id" "uuid" NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."collection_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "is_personal" boolean DEFAULT false,
    "is_public" boolean DEFAULT true,
    "price_paise" integer DEFAULT 0 NOT NULL,
    "curator_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "collection_type" "text" DEFAULT 'list'::"text",
    CONSTRAINT "collections_collection_type_check" CHECK (("collection_type" = ANY (ARRAY['list'::"text", 'course'::"text", 'playbook'::"text"])))
);


ALTER TABLE "public"."collections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "block_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "sentiment" "text" DEFAULT 'neutral'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_objects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'Untitled'::"text" NOT NULL,
    "slug" "text",
    "summary" "text",
    "canonical_thesis" "text",
    "status" "public"."content_status" DEFAULT 'draft'::"public"."content_status" NOT NULL,
    "visibility" "public"."visibility" DEFAULT 'private'::"public"."visibility" NOT NULL,
    "tags" "text"[] DEFAULT ARRAY[]::"text"[],
    "mode_config" "jsonb" DEFAULT '{}'::"jsonb",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "supporting_count" integer DEFAULT 0 NOT NULL,
    "inquiring_count" integer DEFAULT 0 NOT NULL,
    "challenging_count" integer DEFAULT 0 NOT NULL,
    "org_id" "uuid",
    "repost_credits_required" boolean DEFAULT false,
    "reposted_from" "uuid",
    "scheduled_for" timestamp with time zone,
    "tips_enabled" boolean DEFAULT false,
    "sponsorship_enabled" boolean DEFAULT false,
    "cover_image_url" "text",
    "is_nsfw" boolean DEFAULT false,
    "sources" "jsonb" DEFAULT '[]'::"jsonb",
    "allow_inline_comments" boolean DEFAULT true
);


ALTER TABLE "public"."content_objects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_object_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "target_type" "text",
    "target_id" "uuid",
    CONSTRAINT "content_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'resolved'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "content_reports_target_type_check" CHECK (("target_type" = ANY (ARRAY['piece'::"text", 'comment'::"text", 'profile'::"text"])))
);


ALTER TABLE "public"."content_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_quests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "quest_type" "text" NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "quest_key" "text",
    "points_awarded" integer DEFAULT 0
);


ALTER TABLE "public"."daily_quests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debate_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid",
    "user_id" "uuid",
    "stance" "text" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."debate_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debate_room_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."debate_room_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debate_rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_object_id" "uuid",
    "branch_id" "uuid",
    "title" "text" NOT NULL,
    "prompt" "text",
    "is_public" boolean DEFAULT true,
    "access_mode" "text" DEFAULT 'public'::"text" NOT NULL,
    "required_tier_id" "uuid",
    "org_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."debate_rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."earnings_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "source" "text",
    "gross_paise" integer DEFAULT 0,
    "net_paise" integer DEFAULT 0,
    "status" "text" DEFAULT 'paid'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."earnings_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."error_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message" "text" NOT NULL,
    "stack" "text",
    "url" "text",
    "user_agent" "text",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."error_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."insight_points" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "points" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "reason" "text",
    "purchased_points" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."insight_points" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "organization_name" "text" NOT NULL,
    "phone_number" "text",
    "intent" "text" NOT NULL,
    "expected_seats" "text",
    "timeline" "text",
    "details" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."membership_tiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "price_monthly" integer DEFAULT 0 NOT NULL,
    "description" "text",
    "features" "text"[] DEFAULT ARRAY[]::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "icon" "text" DEFAULT 'star'::"text",
    "is_popular" boolean DEFAULT false,
    "author_id" "uuid",
    "price_cents" integer DEFAULT 0,
    "razorpay_plan_id" "text",
    "perks" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."membership_tiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "author_id" "uuid",
    "tier_id" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."moderation_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "moderator_id" "uuid" NOT NULL,
    "content_object_id" "uuid",
    "report_id" "uuid",
    "action" "text" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "moderation_actions_action_check" CHECK (("action" = ANY (ARRAY['takedown_archived'::"text", 'takedown_deleted'::"text", 'dismissed'::"text", 'restored'::"text", 'strike'::"text", 'restriction_lifted'::"text"])))
);


ALTER TABLE "public"."moderation_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."newsletter_dispatches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "piece_id" "uuid" NOT NULL,
    "subject" "text" NOT NULL,
    "recipient_count" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."newsletter_dispatches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "token" "text" NOT NULL,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."org_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "org_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."org_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "plan" "text" NOT NULL,
    "seats" integer NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."org_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."org_workspaces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "plan" "text" DEFAULT 'free'::"text" NOT NULL,
    "seats" integer DEFAULT 3 NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "type" "text" DEFAULT 'standard'::"text" NOT NULL,
    CONSTRAINT "organizations_type_check" CHECK (("type" = ANY (ARRAY['standard'::"text", 'educational_institution'::"text", 'business'::"text"])))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "razorpay_subscription_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "author_id" "uuid"
);


ALTER TABLE "public"."payment_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payout_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "amount_paise" integer DEFAULT 0,
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "destination" "text",
    "reference" "text",
    "processed_by" "uuid",
    "processed_at" timestamp with time zone,
    "failure_reason" "text"
);


ALTER TABLE "public"."payout_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."piece_claps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "piece_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "count" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "piece_claps_count_check" CHECK ((("count" >= 1) AND ("count" <= 50)))
);


ALTER TABLE "public"."piece_claps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."piece_coauthors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "piece_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'coauthor'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."piece_coauthors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."piece_response_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "response_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "vote_type" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "piece_response_votes_vote_type_check" CHECK (("vote_type" = ANY (ARRAY[1, '-1'::integer])))
);


ALTER TABLE "public"."piece_response_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."piece_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "piece_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "parent_id" "uuid",
    "sources" "jsonb" DEFAULT '[]'::"jsonb",
    "quoted_text" "text",
    "serialized_range" "jsonb",
    "is_pinned" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."piece_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."piece_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "piece_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "message" "text",
    "is_auto" boolean DEFAULT false,
    "blocks_snapshot" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."piece_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "handle" "text",
    "display_name" "text",
    "bio" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_customer_id" "text",
    "plan" "text" DEFAULT 'free'::"text",
    "byok_api_key" "text",
    "byok_provider" "text" DEFAULT 'mistral'::"text",
    "byok_model" "text",
    "date_of_birth" "date",
    "xp" integer DEFAULT 0,
    "level" integer DEFAULT 1,
    "credits" integer DEFAULT 0,
    "disability_visual" boolean DEFAULT false,
    "disability_cognitive" boolean DEFAULT false,
    "disability_hearing" boolean DEFAULT false,
    "disability_motor" boolean DEFAULT false,
    "studio_credit_until" timestamp with time zone,
    "strikes" integer DEFAULT 0 NOT NULL,
    "restricted_until" timestamp with time zone,
    "restricted_reason" "text",
    "custom_domain" "text",
    "nsfw_enabled" boolean DEFAULT false
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "amount_paise" integer NOT NULL,
    "razorpay_order_id" "text" NOT NULL,
    "razorpay_payment_id" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "author_id" "uuid",
    "kind" "text",
    "bundle_id" "uuid",
    "content_object_id" "uuid",
    "currency" "text" DEFAULT 'INR'::"text",
    "net_paise" integer
);


ALTER TABLE "public"."purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "quest_type" "text" NOT NULL,
    "stat_key" "text" NOT NULL,
    "target_value" integer NOT NULL,
    "reward_xp" integer DEFAULT 0,
    "reward_credits" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."quests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reader_annotations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "highlight_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "note" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reader_annotations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reader_highlights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "piece_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "text_content" "text" NOT NULL,
    "block_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reader_highlights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reader_pool_distributions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reader_id" "uuid" NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "amount_paise" integer NOT NULL,
    "weight" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reader_pool_distributions_amount_paise_check" CHECK (("amount_paise" >= 0))
);


ALTER TABLE "public"."reader_pool_distributions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reader_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "razorpay_subscription_id" "text" NOT NULL,
    "razorpay_plan_id" "text" NOT NULL,
    "status" "text" DEFAULT 'created'::"text" NOT NULL,
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ip_granted_until" timestamp with time zone,
    "pool_settled_until" timestamp with time zone
);


ALTER TABLE "public"."reader_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reader_telemetry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_object_id" "uuid" NOT NULL,
    "mode" "text" NOT NULL,
    "scroll_depth" integer DEFAULT 0 NOT NULL,
    "dwell_time_seconds" integer DEFAULT 0 NOT NULL,
    "session_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reader_telemetry" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reading_streaks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "current_streak" integer DEFAULT 1 NOT NULL,
    "last_read_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "longest_streak" integer DEFAULT 0,
    "last_read_date" "date",
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."reading_streaks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recommendation_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "piece_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "is_like" boolean NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."recommendation_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recommendations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recommender_id" "uuid" NOT NULL,
    "recommended_id" "uuid" NOT NULL,
    "blurb" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."recommendations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."relationships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_object_id" "uuid" NOT NULL,
    "to_object_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "relationships_type_check" CHECK (("type" = ANY (ARRAY['supports'::"text", 'expands'::"text", 'rebuts'::"text", 'derives_from'::"text", 'teaches'::"text"])))
);


ALTER TABLE "public"."relationships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restriction_appeals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    CONSTRAINT "restriction_appeals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'lifted'::"text", 'denied'::"text"])))
);


ALTER TABLE "public"."restriction_appeals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saves" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "content_object_id" "uuid",
    "collection_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."saves" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sponsorships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_object_id" "uuid",
    "sponsor_name" "text" NOT NULL,
    "sponsor_url" "text",
    "sponsor_logo_url" "text",
    "disclosure_text" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sponsorships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."studio_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subscriber_id" "uuid" NOT NULL,
    "tier_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."studio_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tier_id" "uuid" NOT NULL,
    "stripe_subscription_id" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tds_withholdings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "payout_id" "uuid" NOT NULL,
    "gross_paise" integer NOT NULL,
    "tds_paise" integer NOT NULL,
    "net_paise" integer NOT NULL,
    "quarter" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tds_withholdings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."telemetry_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_object_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "mode" "text",
    "event" "text" DEFAULT 'view'::"text",
    "depth" integer,
    "session" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "piece_id" "uuid" NOT NULL
);


ALTER TABLE "public"."telemetry_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tips" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid",
    "recipient_id" "uuid" NOT NULL,
    "amount_paise" integer NOT NULL,
    "razorpay_order_id" "text" NOT NULL,
    "razorpay_payment_id" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "author_id" "uuid",
    "status" "text" DEFAULT 'paid'::"text",
    "net_paise" bigint NOT NULL
);


ALTER TABLE "public"."tips" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_reward_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "item_type" "text" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "claimed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."user_reward_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "user_roles_role_check" CHECK (("role" = ANY (ARRAY['reader'::"text", 'creator'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_stats" (
    "user_id" "uuid" NOT NULL,
    "pieces_read" integer DEFAULT 0,
    "pieces_written" integer DEFAULT 0,
    "tips_received" integer DEFAULT 0,
    "followers_count" integer DEFAULT 0,
    "current_streak" integer DEFAULT 0,
    "longest_streak" integer DEFAULT 0,
    "last_active_date" "date" DEFAULT CURRENT_DATE,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "streak_restores_used" integer DEFAULT 0,
    "streak_restores_month" "text" DEFAULT ''::"text",
    "streak_broken_at" timestamp with time zone,
    "streak_broken_value" integer DEFAULT 0,
    "has_seen_newsletter_modal" boolean DEFAULT false
);


ALTER TABLE "public"."user_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."workspace_role" DEFAULT 'contributor'::"public"."workspace_role" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workspace_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workspaces" OWNER TO "postgres";


ALTER TABLE ONLY "drizzle"."__drizzle_migrations" ALTER COLUMN "id" SET DEFAULT "nextval"('"drizzle"."__drizzle_migrations_id_seq"'::"regclass");



ALTER TABLE ONLY "drizzle"."__drizzle_migrations"
    ADD CONSTRAINT "__drizzle_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."achievements"
    ADD CONSTRAINT "achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ad_payout_requests"
    ADD CONSTRAINT "ad_payout_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."author_subscribers"
    ADD CONSTRAINT "author_subscribers_author_id_subscriber_email_key" UNIQUE ("author_id", "subscriber_email");



ALTER TABLE ONLY "public"."author_subscribers"
    ADD CONSTRAINT "author_subscribers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boosts"
    ADD CONSTRAINT "boosts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boosts"
    ADD CONSTRAINT "boosts_razorpay_order_id_key" UNIQUE ("razorpay_order_id");



ALTER TABLE ONLY "public"."boosts"
    ADD CONSTRAINT "boosts_razorpay_payment_id_key" UNIQUE ("razorpay_payment_id");



ALTER TABLE ONLY "public"."branch_merge_requests"
    ADD CONSTRAINT "branch_merge_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bundle_items"
    ADD CONSTRAINT "bundle_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bundle_purchases"
    ADD CONSTRAINT "bundle_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bundles"
    ADD CONSTRAINT "bundles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collection_items"
    ADD CONSTRAINT "collection_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collection_progress"
    ADD CONSTRAINT "collection_progress_collection_id_user_id_piece_id_key" UNIQUE ("collection_id", "user_id", "piece_id");



ALTER TABLE ONLY "public"."collection_progress"
    ADD CONSTRAINT "collection_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_objects"
    ADD CONSTRAINT "content_objects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_quests"
    ADD CONSTRAINT "daily_quests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debate_messages"
    ADD CONSTRAINT "debate_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debate_room_invites"
    ADD CONSTRAINT "debate_room_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debate_rooms"
    ADD CONSTRAINT "debate_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."earnings_ledger"
    ADD CONSTRAINT "earnings_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."error_logs"
    ADD CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_author_id_key" UNIQUE ("follower_id", "author_id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."insight_points"
    ADD CONSTRAINT "insight_points_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."membership_tiers"
    ADD CONSTRAINT "membership_tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsletter_dispatches"
    ADD CONSTRAINT "newsletter_dispatches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_invites"
    ADD CONSTRAINT "org_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_invites"
    ADD CONSTRAINT "org_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."org_members"
    ADD CONSTRAINT "org_members_org_id_user_id_key" UNIQUE ("org_id", "user_id");



ALTER TABLE ONLY "public"."org_members"
    ADD CONSTRAINT "org_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_subscriptions"
    ADD CONSTRAINT "org_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_workspaces"
    ADD CONSTRAINT "org_workspaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_workspaces"
    ADD CONSTRAINT "org_workspaces_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."payment_subscriptions"
    ADD CONSTRAINT "payment_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_subscriptions"
    ADD CONSTRAINT "payment_subscriptions_razorpay_subscription_id_key" UNIQUE ("razorpay_subscription_id");



ALTER TABLE ONLY "public"."payout_requests"
    ADD CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."piece_claps"
    ADD CONSTRAINT "piece_claps_piece_id_user_id_key" UNIQUE ("piece_id", "user_id");



ALTER TABLE ONLY "public"."piece_claps"
    ADD CONSTRAINT "piece_claps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."piece_coauthors"
    ADD CONSTRAINT "piece_coauthors_piece_id_user_id_key" UNIQUE ("piece_id", "user_id");



ALTER TABLE ONLY "public"."piece_coauthors"
    ADD CONSTRAINT "piece_coauthors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."piece_response_votes"
    ADD CONSTRAINT "piece_response_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."piece_response_votes"
    ADD CONSTRAINT "piece_response_votes_unique" UNIQUE ("response_id", "user_id");



ALTER TABLE ONLY "public"."piece_responses"
    ADD CONSTRAINT "piece_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."piece_versions"
    ADD CONSTRAINT "piece_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_unique" UNIQUE ("handle");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_custom_domain_unique" UNIQUE ("custom_domain");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_razorpay_order_id_key" UNIQUE ("razorpay_order_id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_razorpay_payment_id_key" UNIQUE ("razorpay_payment_id");



ALTER TABLE ONLY "public"."quests"
    ADD CONSTRAINT "quests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reader_annotations"
    ADD CONSTRAINT "reader_annotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reader_highlights"
    ADD CONSTRAINT "reader_highlights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reader_pool_distributions"
    ADD CONSTRAINT "reader_pool_distributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reader_subscriptions"
    ADD CONSTRAINT "reader_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reader_subscriptions"
    ADD CONSTRAINT "reader_subscriptions_razorpay_subscription_id_key" UNIQUE ("razorpay_subscription_id");



ALTER TABLE ONLY "public"."reader_telemetry"
    ADD CONSTRAINT "reader_telemetry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reading_streaks"
    ADD CONSTRAINT "reading_streaks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reading_streaks"
    ADD CONSTRAINT "reading_streaks_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."recommendation_feedback"
    ADD CONSTRAINT "recommendation_feedback_piece_id_user_id_key" UNIQUE ("piece_id", "user_id");



ALTER TABLE ONLY "public"."recommendation_feedback"
    ADD CONSTRAINT "recommendation_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recommendations"
    ADD CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recommendations"
    ADD CONSTRAINT "recommendations_recommender_id_recommended_id_key" UNIQUE ("recommender_id", "recommended_id");



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restriction_appeals"
    ADD CONSTRAINT "restriction_appeals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saves"
    ADD CONSTRAINT "saves_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sponsorships"
    ADD CONSTRAINT "sponsorships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."studio_subscriptions"
    ADD CONSTRAINT "studio_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tds_withholdings"
    ADD CONSTRAINT "tds_withholdings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."telemetry_events"
    ADD CONSTRAINT "telemetry_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tips"
    ADD CONSTRAINT "tips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tips"
    ADD CONSTRAINT "tips_razorpay_order_id_key" UNIQUE ("razorpay_order_id");



ALTER TABLE ONLY "public"."tips"
    ADD CONSTRAINT "tips_razorpay_payment_id_key" UNIQUE ("razorpay_payment_id");



ALTER TABLE ONLY "public"."user_reward_claims"
    ADD CONSTRAINT "user_reward_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_reward_claims"
    ADD CONSTRAINT "user_reward_claims_user_id_item_type_item_id_key" UNIQUE ("user_id", "item_type", "item_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."user_stats"
    ADD CONSTRAINT "user_stats_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_slug_unique" UNIQUE ("slug");



CREATE INDEX "author_subscribers_subscriber_id_idx" ON "public"."author_subscribers" USING "btree" ("subscriber_id");



CREATE INDEX "content_reports_user_id_idx" ON "public"."content_reports" USING "btree" ("user_id");



CREATE INDEX "idx_ad_payout_requests_user_id" ON "public"."ad_payout_requests" USING "btree" ("user_id");



CREATE INDEX "idx_annotations_highlight_id" ON "public"."reader_annotations" USING "btree" ("highlight_id");



CREATE INDEX "idx_audit_logs_user_id" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_audit_logs_workspace_id" ON "public"."audit_logs" USING "btree" ("workspace_id");



CREATE INDEX "idx_blocks_content_object_id" ON "public"."blocks" USING "btree" ("content_object_id");



CREATE INDEX "idx_boosts_author_id" ON "public"."boosts" USING "btree" ("author_id");



CREATE INDEX "idx_boosts_content_object_id" ON "public"."boosts" USING "btree" ("content_object_id");



CREATE INDEX "idx_boosts_piece_id" ON "public"."boosts" USING "btree" ("piece_id");



CREATE INDEX "idx_boosts_sender_id" ON "public"."boosts" USING "btree" ("sender_id");



CREATE INDEX "idx_branch_merge_requests_author_id" ON "public"."branch_merge_requests" USING "btree" ("author_id");



CREATE INDEX "idx_branch_merge_requests_branch_id" ON "public"."branch_merge_requests" USING "btree" ("branch_id");



CREATE INDEX "idx_branch_merge_requests_reviewer_id" ON "public"."branch_merge_requests" USING "btree" ("reviewer_id");



CREATE INDEX "idx_branch_merge_requests_workspace_id" ON "public"."branch_merge_requests" USING "btree" ("workspace_id");



CREATE INDEX "idx_branches_parent_content_object_id" ON "public"."branches" USING "btree" ("parent_content_object_id");



CREATE INDEX "idx_branches_parent_object_id" ON "public"."branches" USING "btree" ("parent_object_id");



CREATE INDEX "idx_bundle_items_bundle_id" ON "public"."bundle_items" USING "btree" ("bundle_id");



CREATE INDEX "idx_bundle_items_content_object_id" ON "public"."bundle_items" USING "btree" ("content_object_id");



CREATE INDEX "idx_bundle_purchases_bundle_id" ON "public"."bundle_purchases" USING "btree" ("bundle_id");



CREATE INDEX "idx_bundle_purchases_user_id" ON "public"."bundle_purchases" USING "btree" ("user_id");



CREATE INDEX "idx_bundles_author_id" ON "public"."bundles" USING "btree" ("author_id");



CREATE INDEX "idx_bundles_workspace_id" ON "public"."bundles" USING "btree" ("workspace_id");



CREATE INDEX "idx_collection_items_collection_id" ON "public"."collection_items" USING "btree" ("collection_id");



CREATE INDEX "idx_collection_items_content_object_id" ON "public"."collection_items" USING "btree" ("content_object_id");



CREATE INDEX "idx_collection_progress_piece_id" ON "public"."collection_progress" USING "btree" ("piece_id");



CREATE INDEX "idx_collection_progress_user_id" ON "public"."collection_progress" USING "btree" ("user_id");



CREATE INDEX "idx_collections_curator_id" ON "public"."collections" USING "btree" ("curator_id");



CREATE INDEX "idx_comments_author_id" ON "public"."comments" USING "btree" ("author_id");



CREATE INDEX "idx_content_objects_author_id" ON "public"."content_objects" USING "btree" ("author_id");



CREATE INDEX "idx_content_objects_org_id" ON "public"."content_objects" USING "btree" ("org_id");



CREATE INDEX "idx_content_objects_reposted_from" ON "public"."content_objects" USING "btree" ("reposted_from") WHERE ("reposted_from" IS NOT NULL);



CREATE INDEX "idx_content_objects_scheduled_for" ON "public"."content_objects" USING "btree" ("scheduled_for") WHERE ("scheduled_for" IS NOT NULL);



CREATE INDEX "idx_content_objects_workspace_id" ON "public"."content_objects" USING "btree" ("workspace_id");



CREATE INDEX "idx_content_reports_content_object_id" ON "public"."content_reports" USING "btree" ("content_object_id");



CREATE INDEX "idx_daily_quests_user_id" ON "public"."daily_quests" USING "btree" ("user_id");



CREATE INDEX "idx_debate_messages_room_id" ON "public"."debate_messages" USING "btree" ("room_id");



CREATE INDEX "idx_debate_messages_user_id" ON "public"."debate_messages" USING "btree" ("user_id");



CREATE INDEX "idx_debate_room_invites_room_id" ON "public"."debate_room_invites" USING "btree" ("room_id");



CREATE INDEX "idx_debate_room_invites_user_id" ON "public"."debate_room_invites" USING "btree" ("user_id");



CREATE INDEX "idx_debate_rooms_branch_id" ON "public"."debate_rooms" USING "btree" ("branch_id");



CREATE INDEX "idx_debate_rooms_content_object_id" ON "public"."debate_rooms" USING "btree" ("content_object_id");



CREATE INDEX "idx_debate_rooms_created_by" ON "public"."debate_rooms" USING "btree" ("created_by");



CREATE INDEX "idx_debate_rooms_org_id" ON "public"."debate_rooms" USING "btree" ("org_id");



CREATE INDEX "idx_debate_rooms_required_tier_id" ON "public"."debate_rooms" USING "btree" ("required_tier_id");



CREATE INDEX "idx_earnings_ledger_user_id" ON "public"."earnings_ledger" USING "btree" ("user_id");



CREATE INDEX "idx_error_logs_user_id" ON "public"."error_logs" USING "btree" ("user_id");



CREATE INDEX "idx_follows_author_id" ON "public"."follows" USING "btree" ("author_id");



CREATE INDEX "idx_highlights_piece_id" ON "public"."reader_highlights" USING "btree" ("piece_id");



CREATE INDEX "idx_highlights_user_id" ON "public"."reader_highlights" USING "btree" ("user_id");



CREATE INDEX "idx_insight_points_user_id" ON "public"."insight_points" USING "btree" ("user_id");



CREATE INDEX "idx_membership_tiers_author_id" ON "public"."membership_tiers" USING "btree" ("author_id");



CREATE INDEX "idx_membership_tiers_workspace_id" ON "public"."membership_tiers" USING "btree" ("workspace_id");



CREATE INDEX "idx_memberships_author_id" ON "public"."memberships" USING "btree" ("author_id");



CREATE INDEX "idx_memberships_tier_id" ON "public"."memberships" USING "btree" ("tier_id");



CREATE INDEX "idx_memberships_user_id" ON "public"."memberships" USING "btree" ("user_id");



CREATE INDEX "idx_newsletter_dispatches_author_id" ON "public"."newsletter_dispatches" USING "btree" ("author_id");



CREATE INDEX "idx_newsletter_dispatches_piece_id" ON "public"."newsletter_dispatches" USING "btree" ("piece_id");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_org_invites_email" ON "public"."org_invites" USING "btree" ("email");



CREATE INDEX "idx_org_invites_org_id" ON "public"."org_invites" USING "btree" ("org_id");



CREATE INDEX "idx_org_members_user_id" ON "public"."org_members" USING "btree" ("user_id");



CREATE INDEX "idx_org_subscriptions_org_id" ON "public"."org_subscriptions" USING "btree" ("org_id");



CREATE INDEX "idx_org_workspaces_org_id" ON "public"."org_workspaces" USING "btree" ("org_id");



CREATE INDEX "idx_organizations_owner_id" ON "public"."organizations" USING "btree" ("owner_id");



CREATE INDEX "idx_payment_subscriptions_author_id" ON "public"."payment_subscriptions" USING "btree" ("author_id");



CREATE INDEX "idx_payment_subscriptions_user_id" ON "public"."payment_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_payout_requests_user_id" ON "public"."payout_requests" USING "btree" ("user_id");



CREATE INDEX "idx_piece_claps_piece_id" ON "public"."piece_claps" USING "btree" ("piece_id");



CREATE INDEX "idx_piece_claps_user_id" ON "public"."piece_claps" USING "btree" ("user_id");



CREATE INDEX "idx_piece_coauthors_piece_id" ON "public"."piece_coauthors" USING "btree" ("piece_id");



CREATE INDEX "idx_piece_coauthors_user_id" ON "public"."piece_coauthors" USING "btree" ("user_id");



CREATE INDEX "idx_purchases_author_id" ON "public"."purchases" USING "btree" ("author_id");



CREATE INDEX "idx_purchases_bundle_id" ON "public"."purchases" USING "btree" ("bundle_id");



CREATE INDEX "idx_purchases_content_object_id" ON "public"."purchases" USING "btree" ("content_object_id");



CREATE INDEX "idx_purchases_user_id" ON "public"."purchases" USING "btree" ("user_id");



CREATE INDEX "idx_reader_pool_dist_creator" ON "public"."reader_pool_distributions" USING "btree" ("creator_id", "period_end");



CREATE INDEX "idx_reader_pool_dist_reader" ON "public"."reader_pool_distributions" USING "btree" ("reader_id", "period_end");



CREATE INDEX "idx_rec_feedback_piece_id" ON "public"."recommendation_feedback" USING "btree" ("piece_id");



CREATE INDEX "idx_rec_feedback_user_id" ON "public"."recommendation_feedback" USING "btree" ("user_id");



CREATE INDEX "idx_recommendations_recommended_id" ON "public"."recommendations" USING "btree" ("recommended_id");



CREATE INDEX "idx_relationships_from_object_id" ON "public"."relationships" USING "btree" ("from_object_id");



CREATE INDEX "idx_relationships_to_object_id" ON "public"."relationships" USING "btree" ("to_object_id");



CREATE INDEX "idx_saves_collection_id" ON "public"."saves" USING "btree" ("collection_id");



CREATE INDEX "idx_saves_content_object_id" ON "public"."saves" USING "btree" ("content_object_id");



CREATE INDEX "idx_saves_user_id" ON "public"."saves" USING "btree" ("user_id");



CREATE INDEX "idx_sponsorships_content_object_id" ON "public"."sponsorships" USING "btree" ("content_object_id");



CREATE INDEX "idx_studio_subscriptions_subscriber_id" ON "public"."studio_subscriptions" USING "btree" ("subscriber_id");



CREATE INDEX "idx_studio_subscriptions_tier_id" ON "public"."studio_subscriptions" USING "btree" ("tier_id");



CREATE INDEX "idx_subscriptions_tier_id" ON "public"."subscriptions" USING "btree" ("tier_id");



CREATE INDEX "idx_subscriptions_user_id" ON "public"."subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_telemetry_events_created_at" ON "public"."telemetry_events" USING "btree" ("created_at");



CREATE INDEX "idx_telemetry_events_event" ON "public"."telemetry_events" USING "btree" ("event");



CREATE INDEX "idx_telemetry_events_mode" ON "public"."telemetry_events" USING "btree" ("mode");



CREATE INDEX "idx_telemetry_events_piece_id" ON "public"."telemetry_events" USING "btree" ("piece_id");



CREATE INDEX "idx_tips_author_id" ON "public"."tips" USING "btree" ("author_id");



CREATE INDEX "idx_tips_recipient_id" ON "public"."tips" USING "btree" ("recipient_id");



CREATE INDEX "idx_tips_sender_id" ON "public"."tips" USING "btree" ("sender_id");



CREATE INDEX "idx_user_stats_streak_broken" ON "public"."user_stats" USING "btree" ("streak_broken_at") WHERE ("streak_broken_at" IS NOT NULL);



CREATE INDEX "idx_workspace_members_user_id" ON "public"."workspace_members" USING "btree" ("user_id");



CREATE INDEX "idx_workspace_members_workspace_id" ON "public"."workspace_members" USING "btree" ("workspace_id");



CREATE INDEX "idx_workspaces_owner_id" ON "public"."workspaces" USING "btree" ("owner_id");



CREATE INDEX "moderation_actions_content_object_id_idx" ON "public"."moderation_actions" USING "btree" ("content_object_id");



CREATE INDEX "moderation_actions_moderator_id_idx" ON "public"."moderation_actions" USING "btree" ("moderator_id");



CREATE INDEX "moderation_actions_report_id_idx" ON "public"."moderation_actions" USING "btree" ("report_id");



CREATE UNIQUE INDEX "payout_requests_one_open_per_user" ON "public"."payout_requests" USING "btree" ("user_id") WHERE ("status" = ANY (ARRAY['requested'::"text", 'processing'::"text"]));



CREATE INDEX "payout_requests_processed_by_idx" ON "public"."payout_requests" USING "btree" ("processed_by");



CREATE INDEX "piece_response_votes_response_id_idx" ON "public"."piece_response_votes" USING "btree" ("response_id");



CREATE INDEX "piece_response_votes_user_id_idx" ON "public"."piece_response_votes" USING "btree" ("user_id");



CREATE INDEX "piece_responses_parent_id_idx" ON "public"."piece_responses" USING "btree" ("parent_id");



CREATE INDEX "piece_responses_piece_id_idx" ON "public"."piece_responses" USING "btree" ("piece_id");



CREATE INDEX "piece_responses_user_id_idx" ON "public"."piece_responses" USING "btree" ("user_id");



CREATE INDEX "piece_versions_author_id_idx" ON "public"."piece_versions" USING "btree" ("author_id");



CREATE INDEX "piece_versions_piece_id_idx" ON "public"."piece_versions" USING "btree" ("piece_id");



CREATE INDEX "reader_annotations_user_id_idx" ON "public"."reader_annotations" USING "btree" ("user_id");



CREATE INDEX "reader_subscriptions_user_id_idx" ON "public"."reader_subscriptions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "restriction_appeals_one_pending_per_user" ON "public"."restriction_appeals" USING "btree" ("user_id") WHERE ("status" = 'pending'::"text");



CREATE INDEX "restriction_appeals_status_idx" ON "public"."restriction_appeals" USING "btree" ("status");



CREATE UNIQUE INDEX "tds_withholdings_payout_key" ON "public"."tds_withholdings" USING "btree" ("payout_id");



CREATE INDEX "tds_withholdings_quarter_idx" ON "public"."tds_withholdings" USING "btree" ("quarter");



CREATE OR REPLACE TRIGGER "on_piece_published_insert" AFTER INSERT ON "public"."content_objects" FOR EACH ROW EXECUTE FUNCTION "public"."handle_piece_written"();



CREATE OR REPLACE TRIGGER "on_piece_published_update" AFTER UPDATE ON "public"."content_objects" FOR EACH ROW EXECUTE FUNCTION "public"."handle_piece_written"();



CREATE OR REPLACE TRIGGER "on_profile_created_stats" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user_stats"();



ALTER TABLE ONLY "public"."ad_payout_requests"
    ADD CONSTRAINT "ad_payout_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."author_subscribers"
    ADD CONSTRAINT "author_subscribers_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."author_subscribers"
    ADD CONSTRAINT "author_subscribers_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_content_object_id_content_objects_id_fk" FOREIGN KEY ("content_object_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."boosts"
    ADD CONSTRAINT "boosts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."boosts"
    ADD CONSTRAINT "boosts_content_object_id_fkey" FOREIGN KEY ("content_object_id") REFERENCES "public"."content_objects"("id");



ALTER TABLE ONLY "public"."boosts"
    ADD CONSTRAINT "boosts_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."boosts"
    ADD CONSTRAINT "boosts_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."branch_merge_requests"
    ADD CONSTRAINT "branch_merge_requests_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branch_merge_requests"
    ADD CONSTRAINT "branch_merge_requests_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branch_merge_requests"
    ADD CONSTRAINT "branch_merge_requests_reviewer_id_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."branch_merge_requests"
    ADD CONSTRAINT "branch_merge_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_parent_content_object_id_content_objects_id_fk" FOREIGN KEY ("parent_content_object_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_parent_object_id_fkey" FOREIGN KEY ("parent_object_id") REFERENCES "public"."content_objects"("id");



ALTER TABLE ONLY "public"."bundle_items"
    ADD CONSTRAINT "bundle_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bundle_items"
    ADD CONSTRAINT "bundle_items_content_object_id_fkey" FOREIGN KEY ("content_object_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bundle_items"
    ADD CONSTRAINT "bundle_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bundle_purchases"
    ADD CONSTRAINT "bundle_purchases_bundle_id_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bundle_purchases"
    ADD CONSTRAINT "bundle_purchases_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bundles"
    ADD CONSTRAINT "bundles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."bundles"
    ADD CONSTRAINT "bundles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collection_items"
    ADD CONSTRAINT "collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collection_items"
    ADD CONSTRAINT "collection_items_content_object_id_fkey" FOREIGN KEY ("content_object_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collection_progress"
    ADD CONSTRAINT "collection_progress_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collection_progress"
    ADD CONSTRAINT "collection_progress_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collection_progress"
    ADD CONSTRAINT "collection_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_curator_id_fkey" FOREIGN KEY ("curator_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_objects"
    ADD CONSTRAINT "content_objects_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."content_objects"
    ADD CONSTRAINT "content_objects_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_objects"
    ADD CONSTRAINT "content_objects_reposted_from_fkey" FOREIGN KEY ("reposted_from") REFERENCES "public"."content_objects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_objects"
    ADD CONSTRAINT "content_objects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_content_object_id_fkey" FOREIGN KEY ("content_object_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_quests"
    ADD CONSTRAINT "daily_quests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."debate_messages"
    ADD CONSTRAINT "debate_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."debate_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."debate_messages"
    ADD CONSTRAINT "debate_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."debate_room_invites"
    ADD CONSTRAINT "debate_room_invites_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."debate_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."debate_room_invites"
    ADD CONSTRAINT "debate_room_invites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."debate_rooms"
    ADD CONSTRAINT "debate_rooms_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."debate_rooms"
    ADD CONSTRAINT "debate_rooms_content_object_id_fkey" FOREIGN KEY ("content_object_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."debate_rooms"
    ADD CONSTRAINT "debate_rooms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."debate_rooms"
    ADD CONSTRAINT "debate_rooms_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."debate_rooms"
    ADD CONSTRAINT "debate_rooms_required_tier_id_fkey" FOREIGN KEY ("required_tier_id") REFERENCES "public"."membership_tiers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."earnings_ledger"
    ADD CONSTRAINT "earnings_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."error_logs"
    ADD CONSTRAINT "error_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."insight_points"
    ADD CONSTRAINT "insight_points_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."membership_tiers"
    ADD CONSTRAINT "membership_tiers_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."membership_tiers"
    ADD CONSTRAINT "membership_tiers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "public"."membership_tiers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_content_object_id_fkey" FOREIGN KEY ("content_object_id") REFERENCES "public"."content_objects"("id");



ALTER TABLE ONLY "public"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."content_reports"("id");



ALTER TABLE ONLY "public"."newsletter_dispatches"
    ADD CONSTRAINT "newsletter_dispatches_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."newsletter_dispatches"
    ADD CONSTRAINT "newsletter_dispatches_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_invites"
    ADD CONSTRAINT "org_invites_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_members"
    ADD CONSTRAINT "org_members_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_members"
    ADD CONSTRAINT "org_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_subscriptions"
    ADD CONSTRAINT "org_subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_workspaces"
    ADD CONSTRAINT "org_workspaces_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_subscriptions"
    ADD CONSTRAINT "payment_subscriptions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."payment_subscriptions"
    ADD CONSTRAINT "payment_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payout_requests"
    ADD CONSTRAINT "payout_requests_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."payout_requests"
    ADD CONSTRAINT "payout_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."piece_claps"
    ADD CONSTRAINT "piece_claps_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."piece_claps"
    ADD CONSTRAINT "piece_claps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."piece_coauthors"
    ADD CONSTRAINT "piece_coauthors_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."piece_coauthors"
    ADD CONSTRAINT "piece_coauthors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."piece_response_votes"
    ADD CONSTRAINT "piece_response_votes_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "public"."piece_responses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."piece_response_votes"
    ADD CONSTRAINT "piece_response_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."piece_responses"
    ADD CONSTRAINT "piece_responses_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."piece_responses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."piece_responses"
    ADD CONSTRAINT "piece_responses_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."piece_responses"
    ADD CONSTRAINT "piece_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."piece_versions"
    ADD CONSTRAINT "piece_versions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."piece_versions"
    ADD CONSTRAINT "piece_versions_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_content_object_id_fkey" FOREIGN KEY ("content_object_id") REFERENCES "public"."content_objects"("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reader_annotations"
    ADD CONSTRAINT "reader_annotations_highlight_id_fkey" FOREIGN KEY ("highlight_id") REFERENCES "public"."reader_highlights"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reader_annotations"
    ADD CONSTRAINT "reader_annotations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reader_highlights"
    ADD CONSTRAINT "reader_highlights_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reader_highlights"
    ADD CONSTRAINT "reader_highlights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reader_pool_distributions"
    ADD CONSTRAINT "reader_pool_distributions_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reader_pool_distributions"
    ADD CONSTRAINT "reader_pool_distributions_reader_id_fkey" FOREIGN KEY ("reader_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reader_subscriptions"
    ADD CONSTRAINT "reader_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reading_streaks"
    ADD CONSTRAINT "reading_streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recommendation_feedback"
    ADD CONSTRAINT "recommendation_feedback_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recommendation_feedback"
    ADD CONSTRAINT "recommendation_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recommendations"
    ADD CONSTRAINT "recommendations_recommended_id_fkey" FOREIGN KEY ("recommended_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recommendations"
    ADD CONSTRAINT "recommendations_recommender_id_fkey" FOREIGN KEY ("recommender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_from_object_id_fkey" FOREIGN KEY ("from_object_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_to_object_id_fkey" FOREIGN KEY ("to_object_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restriction_appeals"
    ADD CONSTRAINT "restriction_appeals_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."restriction_appeals"
    ADD CONSTRAINT "restriction_appeals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."saves"
    ADD CONSTRAINT "saves_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saves"
    ADD CONSTRAINT "saves_content_object_id_fkey" FOREIGN KEY ("content_object_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saves"
    ADD CONSTRAINT "saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sponsorships"
    ADD CONSTRAINT "sponsorships_content_object_id_fkey" FOREIGN KEY ("content_object_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."studio_subscriptions"
    ADD CONSTRAINT "studio_subscriptions_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."studio_subscriptions"
    ADD CONSTRAINT "studio_subscriptions_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "public"."membership_tiers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_tier_id_membership_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."membership_tiers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tds_withholdings"
    ADD CONSTRAINT "tds_withholdings_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "public"."payout_requests"("id");



ALTER TABLE ONLY "public"."tds_withholdings"
    ADD CONSTRAINT "tds_withholdings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."telemetry_events"
    ADD CONSTRAINT "telemetry_events_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "public"."content_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tips"
    ADD CONSTRAINT "tips_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tips"
    ADD CONSTRAINT "tips_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tips"
    ADD CONSTRAINT "tips_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_reward_claims"
    ADD CONSTRAINT "user_reward_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_stats"
    ADD CONSTRAINT "user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Achievements are readable by everyone" ON "public"."achievements" FOR SELECT USING (true);



CREATE POLICY "Anyone can insert reader telemetry" ON "public"."reader_telemetry" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."content_objects"
  WHERE (("content_objects"."id" = "reader_telemetry"."content_object_id") AND ("content_objects"."status" = 'published'::"public"."content_status")))));



CREATE POLICY "Anyone can insert telemetry" ON "public"."telemetry_events" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."content_objects"
  WHERE (("content_objects"."id" = "telemetry_events"."content_object_id") AND ("content_objects"."status" = 'published'::"public"."content_status")))));



CREATE POLICY "Anyone can subscribe" ON "public"."author_subscribers" FOR INSERT WITH CHECK ((("subscriber_id" IS NULL) OR ("subscriber_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Authors can delete own blocks" ON "public"."blocks" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."content_objects"
  WHERE (("content_objects"."id" = "blocks"."content_object_id") AND ("content_objects"."author_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Authors can delete own branches" ON "public"."branches" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."content_objects"
  WHERE (("content_objects"."id" = "branches"."parent_content_object_id") AND ("content_objects"."author_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Authors can delete own comments" ON "public"."comments" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



CREATE POLICY "Authors can delete own merge requests" ON "public"."branch_merge_requests" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



CREATE POLICY "Authors can insert own blocks" ON "public"."blocks" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."content_objects"
  WHERE (("content_objects"."id" = "blocks"."content_object_id") AND ("content_objects"."author_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Authors can insert own branches" ON "public"."branches" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."content_objects"
  WHERE (("content_objects"."id" = "branches"."parent_content_object_id") AND ("content_objects"."author_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Authors can insert own comments" ON "public"."comments" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



CREATE POLICY "Authors can insert own merge requests" ON "public"."branch_merge_requests" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



CREATE POLICY "Authors can update own blocks" ON "public"."blocks" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."content_objects"
  WHERE (("content_objects"."id" = "blocks"."content_object_id") AND ("content_objects"."author_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Authors can update own branches" ON "public"."branches" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."content_objects"
  WHERE (("content_objects"."id" = "branches"."parent_content_object_id") AND ("content_objects"."author_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Authors can update own comments" ON "public"."comments" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



CREATE POLICY "Authors can update own merge requests" ON "public"."branch_merge_requests" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



CREATE POLICY "Authors can view reader telemetry for own content" ON "public"."reader_telemetry" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."content_objects"
  WHERE (("content_objects"."id" = "reader_telemetry"."content_object_id") AND ("content_objects"."author_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Authors can view telemetry for own content" ON "public"."telemetry_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."content_objects"
  WHERE (("content_objects"."id" = "telemetry_events"."content_object_id") AND ("content_objects"."author_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Blocks are viewable by author or if parent is public" ON "public"."blocks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."content_objects"
  WHERE (("content_objects"."id" = "blocks"."content_object_id") AND (("content_objects"."visibility" = 'public'::"public"."visibility") OR ("content_objects"."author_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Boosts viewable by everyone" ON "public"."boosts" FOR SELECT USING (true);



CREATE POLICY "Branches are viewable by author or if parent is public" ON "public"."branches" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."content_objects"
  WHERE (("content_objects"."id" = "branches"."parent_content_object_id") AND (("content_objects"."visibility" = 'public'::"public"."visibility") OR ("content_objects"."author_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Bundle items viewable by everyone" ON "public"."bundle_items" FOR SELECT USING (true);



CREATE POLICY "Claps are publicly readable" ON "public"."piece_claps" FOR SELECT USING (true);



CREATE POLICY "Comments are viewable by everyone" ON "public"."comments" FOR SELECT USING (true);



CREATE POLICY "Daily quests are viewable by owner" ON "public"."daily_quests" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Follows are viewable by everyone" ON "public"."follows" FOR SELECT USING (true);



CREATE POLICY "Insight points are viewable by owner" ON "public"."insight_points" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Members can view merge requests" ON "public"."branch_merge_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "wm"
  WHERE (("wm"."workspace_id" = "branch_merge_requests"."workspace_id") AND ("wm"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Org admins can manage invites" ON "public"."org_invites" USING ((EXISTS ( SELECT 1
   FROM "public"."org_members"
  WHERE (("org_members"."org_id" = "org_invites"."org_id") AND ("org_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("org_members"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."org_members"
  WHERE (("org_members"."org_id" = "org_invites"."org_id") AND ("org_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("org_members"."role" = 'admin'::"text")))));



CREATE POLICY "Org members can read workspaces" ON "public"."org_workspaces" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."org_members"
  WHERE (("org_members"."org_id" = "org_workspaces"."org_id") AND ("org_members"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Organizations are viewable by members" ON "public"."organizations" FOR SELECT USING (true);



CREATE POLICY "Owners can delete bundle items" ON "public"."bundle_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."bundles" "b"
     JOIN "public"."workspaces" "w" ON (("b"."workspace_id" = "w"."id")))
  WHERE (("b"."id" = "bundle_items"."bundle_id") AND ("w"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Owners can delete workspace members" ON "public"."workspace_members" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."workspaces"
  WHERE (("workspaces"."id" = "workspace_members"."workspace_id") AND ("workspaces"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Owners can insert bundle items" ON "public"."bundle_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."bundles" "b"
     JOIN "public"."workspaces" "w" ON (("b"."workspace_id" = "w"."id")))
  WHERE (("b"."id" = "bundle_items"."bundle_id") AND ("w"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Owners can insert own workspaces" ON "public"."workspaces" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));



CREATE POLICY "Owners can insert workspace members" ON "public"."workspace_members" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."workspaces"
  WHERE (("workspaces"."id" = "workspace_members"."workspace_id") AND ("workspaces"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Owners can update bundle items" ON "public"."bundle_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."bundles" "b"
     JOIN "public"."workspaces" "w" ON (("b"."workspace_id" = "w"."id")))
  WHERE (("b"."id" = "bundle_items"."bundle_id") AND ("w"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Owners can update own workspaces" ON "public"."workspaces" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));



CREATE POLICY "Owners can update workspace members" ON "public"."workspace_members" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."workspaces"
  WHERE (("workspaces"."id" = "workspace_members"."workspace_id") AND ("workspaces"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Owners can view own workspaces" ON "public"."workspaces" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));



CREATE POLICY "Payment subscriptions viewable by owner" ON "public"."payment_subscriptions" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Pool distributions visible to reader and creator" ON "public"."reader_pool_distributions" FOR SELECT USING ((("reader_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("creator_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Public bundles are viewable by everyone" ON "public"."bundles" FOR SELECT USING ((("visibility" = 'public'::"public"."visibility") OR (EXISTS ( SELECT 1
   FROM "public"."workspaces"
  WHERE (("workspaces"."id" = "bundles"."workspace_id") AND ("workspaces"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "bundles_insert_own" ON "public"."bundles" FOR INSERT WITH CHECK (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "bundles_update_own" ON "public"."bundles" FOR UPDATE USING (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "bundles_delete_own" ON "public"."bundles" FOR DELETE USING (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Purchases are viewable by purchaser or bundle owner" ON "public"."bundle_purchases" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR (EXISTS ( SELECT 1
   FROM ("public"."bundles" "b"
     JOIN "public"."workspaces" "w" ON (("b"."workspace_id" = "w"."id")))
  WHERE (("b"."id" = "bundle_purchases"."bundle_id") AND ("w"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Purchases viewable by owner" ON "public"."purchases" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Quests are readable by everyone" ON "public"."quests" FOR SELECT USING (true);



CREATE POLICY "Reader subscriptions viewable by user" ON "public"."reader_subscriptions" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Reading streaks are viewable by owner" ON "public"."reading_streaks" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Recommendations are viewable by everyone" ON "public"."recommendations" FOR SELECT USING (true);



CREATE POLICY "Relationships viewable by everyone" ON "public"."relationships" FOR SELECT USING (true);



CREATE POLICY "Studio subscriptions viewable by subscriber" ON "public"."studio_subscriptions" FOR SELECT USING (("subscriber_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Subscribers can unsubscribe" ON "public"."author_subscribers" FOR DELETE USING ((((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (( SELECT "auth"."uid"() AS "uid") = "subscriber_id")) OR (( SELECT "auth"."uid"() AS "uid") = "author_id")));



CREATE POLICY "Subscriptions are viewable by subscriber or tier owner" ON "public"."subscriptions" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR (EXISTS ( SELECT 1
   FROM ("public"."membership_tiers" "t"
     JOIN "public"."workspaces" "w" ON (("t"."workspace_id" = "w"."id")))
  WHERE (("t"."id" = "subscriptions"."tier_id") AND ("w"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Tiers are viewable by everyone" ON "public"."membership_tiers" FOR SELECT USING (true);


CREATE POLICY "membership_tiers_insert_own" ON "public"."membership_tiers" FOR INSERT WITH CHECK (("author_id" = ( SELECT "auth"."uid"() AS "uid")));


CREATE POLICY "membership_tiers_update_own" ON "public"."membership_tiers" FOR UPDATE USING (("author_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("author_id" = ( SELECT "auth"."uid"() AS "uid")));


CREATE POLICY "membership_tiers_delete_own" ON "public"."membership_tiers" FOR DELETE USING (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Tips viewable by sender" ON "public"."tips" FOR SELECT USING (("sender_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Unified permissive insert" ON "public"."content_objects" FOR INSERT WITH CHECK ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE ("org_members"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Unified permissive select" ON "public"."content_objects" FOR SELECT USING ((("status" = 'published'::"public"."content_status") OR ("author_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE ("org_members"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Unified permissive update" ON "public"."content_objects" FOR UPDATE USING ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE ("org_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "private"."is_piece_coauthor"("id")));



CREATE POLICY "Users can claim rewards" ON "public"."user_reward_claims" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can create their own recommendations" ON "public"."recommendations" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "recommender_id"));



CREATE POLICY "Users can create versions of pieces they own" ON "public"."piece_versions" FOR INSERT WITH CHECK ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("piece_id" IN ( SELECT "piece_coauthors"."piece_id"
   FROM "public"."piece_coauthors"
  WHERE ("piece_coauthors"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can delete follows" ON "public"."follows" FOR DELETE USING (("follower_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can delete their own claps" ON "public"."piece_claps" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own recommendations" ON "public"."recommendations" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "recommender_id"));



CREATE POLICY "Users can delete their own versions" ON "public"."piece_versions" FOR DELETE USING (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can delete their own votes" ON "public"."piece_response_votes" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert follows" ON "public"."follows" FOR INSERT WITH CHECK (("follower_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert own feedback" ON "public"."recommendation_feedback" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own payout requests" ON "public"."ad_payout_requests" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own claps" ON "public"."piece_claps" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own dispatches" ON "public"."newsletter_dispatches" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



CREATE POLICY "Users can insert their own votes" ON "public"."piece_response_votes" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can manage their own annotations" ON "public"."reader_annotations" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can manage their own highlights" ON "public"."reader_highlights" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can manage their own progress" ON "public"."collection_progress" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own feedback" ON "public"."recommendation_feedback" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can read own reports" ON "public"."content_reports" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own feedback" ON "public"."recommendation_feedback" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can update their own claps" ON "public"."piece_claps" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update their own votes" ON "public"."piece_response_votes" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view all stats" ON "public"."user_stats" FOR SELECT USING (true);



CREATE POLICY "Users can view all votes" ON "public"."piece_response_votes" FOR SELECT USING (true);



CREATE POLICY "Users can view audit logs for their workspaces" ON "public"."audit_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "wm"
  WHERE (("wm"."workspace_id" = "audit_logs"."workspace_id") AND ("wm"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view members of their workspaces" ON "public"."workspace_members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "wm"
  WHERE (("wm"."workspace_id" = "workspace_members"."workspace_id") AND ("wm"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view own payout requests" ON "public"."ad_payout_requests" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own claims" ON "public"."user_reward_claims" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own dispatches" ON "public"."newsletter_dispatches" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



CREATE POLICY "Users can view their own error logs" ON "public"."error_logs" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own roles" ON "public"."user_roles" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own subscribers" ON "public"."author_subscribers" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



CREATE POLICY "Users can view versions of pieces they own" ON "public"."piece_versions" FOR SELECT USING ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("piece_id" IN ( SELECT "piece_coauthors"."piece_id"
   FROM "public"."piece_coauthors"
  WHERE ("piece_coauthors"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."achievements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ad_payout_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."author_subscribers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."boosts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."branch_merge_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bundle_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bundle_purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bundles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collection_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "collection_items_read" ON "public"."collection_items" FOR SELECT USING (true);



ALTER TABLE "public"."collection_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "collections_delete" ON "public"."collections" FOR DELETE USING (("curator_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "collections_insert" ON "public"."collections" FOR INSERT WITH CHECK (("curator_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "collections_read" ON "public"."collections" FOR SELECT USING (true);



CREATE POLICY "collections_update" ON "public"."collections" FOR UPDATE USING (("curator_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_objects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_quests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."debate_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "debate_messages_delete" ON "public"."debate_messages" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "debate_messages_insert" ON "public"."debate_messages" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "debate_messages_read" ON "public"."debate_messages" FOR SELECT USING (true);



CREATE POLICY "debate_messages_update" ON "public"."debate_messages" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."debate_room_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "debate_room_invites_delete" ON "public"."debate_room_invites" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "debate_room_invites_insert" ON "public"."debate_room_invites" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "debate_room_invites_read" ON "public"."debate_room_invites" FOR SELECT USING (true);



CREATE POLICY "debate_room_invites_update" ON "public"."debate_room_invites" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."debate_rooms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "debate_rooms_delete" ON "public"."debate_rooms" FOR DELETE USING (("created_by" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "debate_rooms_insert" ON "public"."debate_rooms" FOR INSERT WITH CHECK (("created_by" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "debate_rooms_read" ON "public"."debate_rooms" FOR SELECT USING (true);



CREATE POLICY "debate_rooms_update" ON "public"."debate_rooms" FOR UPDATE USING (("created_by" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."earnings_ledger" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "earnings_ledger_read" ON "public"."earnings_ledger" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."error_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."insight_points" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leads_no_client_access" ON "public"."leads" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."membership_tiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "memberships_read" ON "public"."memberships" FOR SELECT USING ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."moderation_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "moderation_actions_no_client_access" ON "public"."moderation_actions" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."newsletter_dispatches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_members_read_own" ON "public"."org_members" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."org_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_subscriptions_read_admin" ON "public"."org_subscriptions" FOR SELECT USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("org_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



ALTER TABLE "public"."org_workspaces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payout_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payout_requests_insert" ON "public"."payout_requests" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "payout_requests_read" ON "public"."payout_requests" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."piece_claps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."piece_coauthors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "piece_coauthors_delete" ON "public"."piece_coauthors" FOR DELETE USING ("private"."is_piece_author"("piece_id"));



CREATE POLICY "piece_coauthors_insert" ON "public"."piece_coauthors" FOR INSERT WITH CHECK ("private"."is_piece_author"("piece_id"));



CREATE POLICY "piece_coauthors_select" ON "public"."piece_coauthors" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "piece_coauthors_update" ON "public"."piece_coauthors" FOR UPDATE USING ("private"."is_piece_author"("piece_id"));



ALTER TABLE "public"."piece_response_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."piece_responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "piece_responses_read" ON "public"."piece_responses" FOR SELECT USING (true);


CREATE POLICY "piece_responses_insert" ON "public"."piece_responses" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


CREATE POLICY "piece_responses_update_own" ON "public"."piece_responses" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


CREATE POLICY "piece_responses_pin_by_piece_author" ON "public"."piece_responses" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."content_objects" "co"
  WHERE (("co"."id" = "piece_responses"."piece_id") AND ("co"."author_id" = ( SELECT "auth"."uid"() AS "uid"))))));


CREATE POLICY "piece_responses_delete_own" ON "public"."piece_responses" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."piece_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reader_annotations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reader_highlights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reader_pool_distributions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reader_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reader_telemetry" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reading_streaks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recommendation_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recommendations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."relationships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restriction_appeals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saves" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "saves_delete" ON "public"."saves" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "saves_insert" ON "public"."saves" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "saves_read" ON "public"."saves" FOR SELECT USING (true);



CREATE POLICY "saves_update" ON "public"."saves" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."sponsorships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sponsorships_read" ON "public"."sponsorships" FOR SELECT USING (true);



ALTER TABLE "public"."studio_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tds_withholdings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."telemetry_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tips" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_reward_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspace_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";












































































































































































































































































































































































































































































































REVOKE ALL ON FUNCTION "public"."handle_follow_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_follow_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_piece_written"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_piece_written"() TO "service_role";

































GRANT ALL ON TABLE "public"."achievements" TO "anon";
GRANT ALL ON TABLE "public"."achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."achievements" TO "service_role";



GRANT ALL ON TABLE "public"."ad_payout_requests" TO "anon";
GRANT ALL ON TABLE "public"."ad_payout_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."ad_payout_requests" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."author_subscribers" TO "anon";
GRANT ALL ON TABLE "public"."author_subscribers" TO "authenticated";
GRANT ALL ON TABLE "public"."author_subscribers" TO "service_role";



GRANT ALL ON TABLE "public"."blocks" TO "anon";
GRANT ALL ON TABLE "public"."blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."blocks" TO "service_role";



GRANT ALL ON TABLE "public"."boosts" TO "anon";
GRANT ALL ON TABLE "public"."boosts" TO "authenticated";
GRANT ALL ON TABLE "public"."boosts" TO "service_role";



GRANT ALL ON TABLE "public"."branch_merge_requests" TO "anon";
GRANT ALL ON TABLE "public"."branch_merge_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."branch_merge_requests" TO "service_role";



GRANT ALL ON TABLE "public"."branches" TO "anon";
GRANT ALL ON TABLE "public"."branches" TO "authenticated";
GRANT ALL ON TABLE "public"."branches" TO "service_role";



GRANT ALL ON TABLE "public"."bundle_items" TO "anon";
GRANT ALL ON TABLE "public"."bundle_items" TO "authenticated";
GRANT ALL ON TABLE "public"."bundle_items" TO "service_role";



GRANT ALL ON TABLE "public"."bundle_purchases" TO "anon";
GRANT ALL ON TABLE "public"."bundle_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."bundle_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."bundles" TO "anon";
GRANT ALL ON TABLE "public"."bundles" TO "authenticated";
GRANT ALL ON TABLE "public"."bundles" TO "service_role";



GRANT ALL ON TABLE "public"."collection_items" TO "anon";
GRANT ALL ON TABLE "public"."collection_items" TO "authenticated";
GRANT ALL ON TABLE "public"."collection_items" TO "service_role";



GRANT ALL ON TABLE "public"."collection_progress" TO "anon";
GRANT ALL ON TABLE "public"."collection_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."collection_progress" TO "service_role";



GRANT ALL ON TABLE "public"."collections" TO "anon";
GRANT ALL ON TABLE "public"."collections" TO "authenticated";
GRANT ALL ON TABLE "public"."collections" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."content_objects" TO "anon";
GRANT ALL ON TABLE "public"."content_objects" TO "authenticated";
GRANT ALL ON TABLE "public"."content_objects" TO "service_role";



GRANT ALL ON TABLE "public"."content_reports" TO "anon";
GRANT ALL ON TABLE "public"."content_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."content_reports" TO "service_role";



GRANT ALL ON TABLE "public"."daily_quests" TO "anon";
GRANT ALL ON TABLE "public"."daily_quests" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_quests" TO "service_role";



GRANT ALL ON TABLE "public"."debate_messages" TO "anon";
GRANT ALL ON TABLE "public"."debate_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."debate_messages" TO "service_role";



GRANT ALL ON TABLE "public"."debate_room_invites" TO "anon";
GRANT ALL ON TABLE "public"."debate_room_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."debate_room_invites" TO "service_role";



GRANT ALL ON TABLE "public"."debate_rooms" TO "anon";
GRANT ALL ON TABLE "public"."debate_rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."debate_rooms" TO "service_role";



GRANT ALL ON TABLE "public"."earnings_ledger" TO "anon";
GRANT ALL ON TABLE "public"."earnings_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."earnings_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."error_logs" TO "anon";
GRANT ALL ON TABLE "public"."error_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."error_logs" TO "service_role";



GRANT ALL ON TABLE "public"."follows" TO "anon";
GRANT ALL ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."insight_points" TO "anon";
GRANT ALL ON TABLE "public"."insight_points" TO "authenticated";
GRANT ALL ON TABLE "public"."insight_points" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."membership_tiers" TO "anon";
GRANT ALL ON TABLE "public"."membership_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."membership_tiers" TO "service_role";



GRANT ALL ON TABLE "public"."memberships" TO "anon";
GRANT ALL ON TABLE "public"."memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."memberships" TO "service_role";



GRANT ALL ON TABLE "public"."moderation_actions" TO "anon";
GRANT ALL ON TABLE "public"."moderation_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."moderation_actions" TO "service_role";



GRANT ALL ON TABLE "public"."newsletter_dispatches" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_dispatches" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_dispatches" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."org_invites" TO "anon";
GRANT ALL ON TABLE "public"."org_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."org_invites" TO "service_role";



GRANT ALL ON TABLE "public"."org_members" TO "anon";
GRANT ALL ON TABLE "public"."org_members" TO "authenticated";
GRANT ALL ON TABLE "public"."org_members" TO "service_role";



GRANT ALL ON TABLE "public"."org_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."org_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."org_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."org_workspaces" TO "anon";
GRANT ALL ON TABLE "public"."org_workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."org_workspaces" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."payment_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."payment_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."payout_requests" TO "anon";
GRANT ALL ON TABLE "public"."payout_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."payout_requests" TO "service_role";



GRANT ALL ON TABLE "public"."piece_claps" TO "anon";
GRANT ALL ON TABLE "public"."piece_claps" TO "authenticated";
GRANT ALL ON TABLE "public"."piece_claps" TO "service_role";



GRANT ALL ON TABLE "public"."piece_coauthors" TO "anon";
GRANT ALL ON TABLE "public"."piece_coauthors" TO "authenticated";
GRANT ALL ON TABLE "public"."piece_coauthors" TO "service_role";



GRANT ALL ON TABLE "public"."piece_response_votes" TO "anon";
GRANT ALL ON TABLE "public"."piece_response_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."piece_response_votes" TO "service_role";



GRANT ALL ON TABLE "public"."piece_responses" TO "anon";
GRANT ALL ON TABLE "public"."piece_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."piece_responses" TO "service_role";



GRANT ALL ON TABLE "public"."piece_versions" TO "anon";
GRANT ALL ON TABLE "public"."piece_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."piece_versions" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("id") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("handle") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("handle") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("display_name") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("display_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("bio") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("bio") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("avatar_url") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("avatar_url") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("created_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("updated_at") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("updated_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("plan") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("plan") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("byok_provider") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("byok_provider") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("byok_model") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("byok_model") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("xp") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("xp") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("level") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("level") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("credits") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("credits") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("studio_credit_until") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("studio_credit_until") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("custom_domain") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("custom_domain") ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."purchases" TO "anon";
GRANT ALL ON TABLE "public"."purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."purchases" TO "service_role";



GRANT ALL ON TABLE "public"."quests" TO "anon";
GRANT ALL ON TABLE "public"."quests" TO "authenticated";
GRANT ALL ON TABLE "public"."quests" TO "service_role";



GRANT ALL ON TABLE "public"."reader_annotations" TO "anon";
GRANT ALL ON TABLE "public"."reader_annotations" TO "authenticated";
GRANT ALL ON TABLE "public"."reader_annotations" TO "service_role";



GRANT ALL ON TABLE "public"."reader_highlights" TO "anon";
GRANT ALL ON TABLE "public"."reader_highlights" TO "authenticated";
GRANT ALL ON TABLE "public"."reader_highlights" TO "service_role";



GRANT ALL ON TABLE "public"."reader_pool_distributions" TO "anon";
GRANT ALL ON TABLE "public"."reader_pool_distributions" TO "authenticated";
GRANT ALL ON TABLE "public"."reader_pool_distributions" TO "service_role";



GRANT ALL ON TABLE "public"."reader_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."reader_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."reader_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."reader_telemetry" TO "anon";
GRANT ALL ON TABLE "public"."reader_telemetry" TO "authenticated";
GRANT ALL ON TABLE "public"."reader_telemetry" TO "service_role";



GRANT ALL ON TABLE "public"."reading_streaks" TO "anon";
GRANT ALL ON TABLE "public"."reading_streaks" TO "authenticated";
GRANT ALL ON TABLE "public"."reading_streaks" TO "service_role";



GRANT ALL ON TABLE "public"."recommendation_feedback" TO "anon";
GRANT ALL ON TABLE "public"."recommendation_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."recommendation_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."recommendations" TO "anon";
GRANT ALL ON TABLE "public"."recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."relationships" TO "anon";
GRANT ALL ON TABLE "public"."relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."relationships" TO "service_role";



GRANT ALL ON TABLE "public"."restriction_appeals" TO "anon";
GRANT ALL ON TABLE "public"."restriction_appeals" TO "authenticated";
GRANT ALL ON TABLE "public"."restriction_appeals" TO "service_role";



GRANT ALL ON TABLE "public"."saves" TO "anon";
GRANT ALL ON TABLE "public"."saves" TO "authenticated";
GRANT ALL ON TABLE "public"."saves" TO "service_role";



GRANT ALL ON TABLE "public"."sponsorships" TO "anon";
GRANT ALL ON TABLE "public"."sponsorships" TO "authenticated";
GRANT ALL ON TABLE "public"."sponsorships" TO "service_role";



GRANT ALL ON TABLE "public"."studio_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."studio_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."studio_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."tds_withholdings" TO "anon";
GRANT ALL ON TABLE "public"."tds_withholdings" TO "authenticated";
GRANT ALL ON TABLE "public"."tds_withholdings" TO "service_role";



GRANT ALL ON TABLE "public"."telemetry_events" TO "anon";
GRANT ALL ON TABLE "public"."telemetry_events" TO "authenticated";
GRANT ALL ON TABLE "public"."telemetry_events" TO "service_role";



GRANT ALL ON TABLE "public"."tips" TO "anon";
GRANT ALL ON TABLE "public"."tips" TO "authenticated";
GRANT ALL ON TABLE "public"."tips" TO "service_role";



GRANT ALL ON TABLE "public"."user_reward_claims" TO "anon";
GRANT ALL ON TABLE "public"."user_reward_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."user_reward_claims" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_stats" TO "anon";
GRANT ALL ON TABLE "public"."user_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."user_stats" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_members" TO "anon";
GRANT ALL ON TABLE "public"."workspace_members" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_members" TO "service_role";



GRANT ALL ON TABLE "public"."workspaces" TO "anon";
GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































