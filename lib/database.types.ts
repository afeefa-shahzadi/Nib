export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          reward_xp: number | null
          stat_key: string
          target_value: number
          tier: string
          title: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          reward_xp?: number | null
          stat_key: string
          target_value: number
          tier: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          reward_xp?: number | null
          stat_key?: string
          target_value?: number
          tier?: string
          title?: string
        }
        Relationships: []
      }
      ad_payout_requests: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_payout_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string
          workspace_id: string
        }
        ComputedFields: never
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_workspace_id_workspaces_id_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      author_subscribers: {
        Row: {
          author_id: string
          confirmed_at: string | null
          created_at: string
          id: string
          subscriber_email: string
          subscriber_id: string | null
        }
        ComputedFields: never
        Insert: {
          author_id: string
          confirmed_at?: string | null
          created_at?: string
          id?: string
          subscriber_email: string
          subscriber_id?: string | null
        }
        Update: {
          author_id?: string
          confirmed_at?: string | null
          created_at?: string
          id?: string
          subscriber_email?: string
          subscriber_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "author_subscribers_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          content: NonNullable<Json>
          content_object_id: string
          created_at: string
          display_priority: number | null
          embedding: string | null
          id: string
          is_nsfw: boolean | null
          mode_visibility: Json | null
          monetization_eligible: boolean | null
          order: number
          semantic_role: string | null
          sources: Json | null
          type: Database["public"]["Enums"]["block_type"]
          version: number
        }
        ComputedFields: never
        Insert: {
          content?: NonNullable<Json>
          content_object_id: string
          created_at?: string
          display_priority?: number | null
          embedding?: string | null
          id?: string
          is_nsfw?: boolean | null
          mode_visibility?: Json | null
          monetization_eligible?: boolean | null
          order?: number
          semantic_role?: string | null
          sources?: Json | null
          type?: Database["public"]["Enums"]["block_type"]
          version?: number
        }
        Update: {
          content?: NonNullable<Json>
          content_object_id?: string
          created_at?: string
          display_priority?: number | null
          embedding?: string | null
          id?: string
          is_nsfw?: boolean | null
          mode_visibility?: Json | null
          monetization_eligible?: boolean | null
          order?: number
          semantic_role?: string | null
          sources?: Json | null
          type?: Database["public"]["Enums"]["block_type"]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "blocks_content_object_id_content_objects_id_fk"
            columns: ["content_object_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      boosts: {
        Row: {
          amount_paise: number
          annotator_pool_paise: number | null
          author_id: string | null
          content_object_id: string | null
          created_at: string
          duration_hours: number | null
          ends_at: string | null
          id: string
          piece_id: string
          razorpay_order_id: string
          razorpay_payment_id: string | null
          sender_id: string | null
          starts_at: string | null
          status: string | null
        }
        ComputedFields: never
        Insert: {
          amount_paise: number
          annotator_pool_paise?: number | null
          author_id?: string | null
          content_object_id?: string | null
          created_at?: string
          duration_hours?: number | null
          ends_at?: string | null
          id?: string
          piece_id: string
          razorpay_order_id: string
          razorpay_payment_id?: string | null
          sender_id?: string | null
          starts_at?: string | null
          status?: string | null
        }
        Update: {
          amount_paise?: number
          annotator_pool_paise?: number | null
          author_id?: string | null
          content_object_id?: string | null
          created_at?: string
          duration_hours?: number | null
          ends_at?: string | null
          id?: string
          piece_id?: string
          razorpay_order_id?: string
          razorpay_payment_id?: string | null
          sender_id?: string | null
          starts_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boosts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boosts_content_object_id_fkey"
            columns: ["content_object_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boosts_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boosts_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_merge_requests: {
        Row: {
          author_id: string
          branch_id: string
          conflict_details: string | null
          created_at: string
          id: string
          reviewer_id: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        ComputedFields: never
        Insert: {
          author_id: string
          branch_id: string
          conflict_details?: string | null
          created_at?: string
          id?: string
          reviewer_id?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          author_id?: string
          branch_id?: string
          conflict_details?: string | null
          created_at?: string
          id?: string
          reviewer_id?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_merge_requests_author_id_profiles_id_fk"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_merge_requests_branch_id_branches_id_fk"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_merge_requests_reviewer_id_profiles_id_fk"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_merge_requests_workspace_id_workspaces_id_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          branch_type: string | null
          created_at: string
          derived_changes_summary: string | null
          id: string
          parent_content_object_id: string
          parent_object_id: string | null
          purpose: string | null
          state: string | null
          status: Database["public"]["Enums"]["content_status"]
          summary: string | null
          type: Database["public"]["Enums"]["branch_type"]
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
        }
        ComputedFields: never
        Insert: {
          branch_type?: string | null
          created_at?: string
          derived_changes_summary?: string | null
          id?: string
          parent_content_object_id: string
          parent_object_id?: string | null
          purpose?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          type: Database["public"]["Enums"]["branch_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Update: {
          branch_type?: string | null
          created_at?: string
          derived_changes_summary?: string | null
          id?: string
          parent_content_object_id?: string
          parent_object_id?: string | null
          purpose?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          type?: Database["public"]["Enums"]["branch_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "branches_parent_content_object_id_content_objects_id_fk"
            columns: ["parent_content_object_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_parent_object_id_fkey"
            columns: ["parent_object_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_items: {
        Row: {
          branch_id: string | null
          bundle_id: string
          content_object_id: string | null
          created_at: string
          id: string
          position: number
        }
        ComputedFields: never
        Insert: {
          branch_id?: string | null
          bundle_id: string
          content_object_id?: string | null
          created_at?: string
          id?: string
          position?: number
        }
        Update: {
          branch_id?: string | null
          bundle_id?: string
          content_object_id?: string | null
          created_at?: string
          id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "bundle_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_items_content_object_id_fkey"
            columns: ["content_object_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_purchases: {
        Row: {
          bundle_id: string
          created_at: string
          id: string
          stripe_session_id: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          bundle_id: string
          created_at?: string
          id?: string
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          bundle_id?: string
          created_at?: string
          id?: string
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_purchases_bundle_id_bundles_id_fk"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_purchases_user_id_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bundles: {
        Row: {
          author_id: string | null
          created_at: string
          description: string | null
          id: string
          outcome_statement: string | null
          price: number
          title: string
          visibility: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        ComputedFields: never
        Insert: {
          author_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          outcome_statement?: string | null
          price?: number
          title: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          outcome_statement?: string | null
          price?: number
          title?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundles_workspace_id_workspaces_id_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items: {
        Row: {
          collection_id: string | null
          content_object_id: string | null
          created_at: string | null
          id: string
        }
        ComputedFields: never
        Insert: {
          collection_id?: string | null
          content_object_id?: string | null
          created_at?: string | null
          id?: string
        }
        Update: {
          collection_id?: string | null
          content_object_id?: string | null
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_content_object_id_fkey"
            columns: ["content_object_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_progress: {
        Row: {
          collection_id: string
          completed_at: string
          id: string
          piece_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          collection_id: string
          completed_at?: string
          id?: string
          piece_id: string
          user_id: string
        }
        Update: {
          collection_id?: string
          completed_at?: string
          id?: string
          piece_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_progress_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_progress_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          collection_type: string | null
          created_at: string | null
          curator_id: string | null
          description: string | null
          id: string
          is_personal: boolean | null
          is_public: boolean | null
          price_paise: number
          title: string
        }
        ComputedFields: never
        Insert: {
          collection_type?: string | null
          created_at?: string | null
          curator_id?: string | null
          description?: string | null
          id?: string
          is_personal?: boolean | null
          is_public?: boolean | null
          price_paise?: number
          title: string
        }
        Update: {
          collection_type?: string | null
          created_at?: string | null
          curator_id?: string | null
          description?: string | null
          id?: string
          is_personal?: boolean | null
          is_public?: boolean | null
          price_paise?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_curator_id_fkey"
            columns: ["curator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          block_id: string
          content: string
          created_at: string
          id: string
          sentiment: string | null
        }
        ComputedFields: never
        Insert: {
          author_id: string
          block_id: string
          content: string
          created_at?: string
          id?: string
          sentiment?: string | null
        }
        Update: {
          author_id?: string
          block_id?: string
          content?: string
          created_at?: string
          id?: string
          sentiment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_profiles_id_fk"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_objects: {
        Row: {
          allow_inline_comments: boolean | null
          author_id: string
          canonical_thesis: string | null
          challenging_count: number
          cover_image_url: string | null
          created_at: string
          id: string
          inquiring_count: number
          is_nsfw: boolean | null
          mode_config: Json | null
          org_id: string | null
          published_at: string | null
          repost_credits_required: boolean | null
          reposted_from: string | null
          scheduled_for: string | null
          slug: string | null
          source_url: string | null
          sources: Json | null
          sponsorship_enabled: boolean | null
          status: Database["public"]["Enums"]["content_status"]
          summary: string | null
          supporting_count: number
          tags: string[] | null
          tips_enabled: boolean | null
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        ComputedFields: never
        Insert: {
          allow_inline_comments?: boolean | null
          author_id: string
          canonical_thesis?: string | null
          challenging_count?: number
          cover_image_url?: string | null
          created_at?: string
          id?: string
          inquiring_count?: number
          is_nsfw?: boolean | null
          mode_config?: Json | null
          org_id?: string | null
          published_at?: string | null
          repost_credits_required?: boolean | null
          reposted_from?: string | null
          scheduled_for?: string | null
          slug?: string | null
          source_url?: string | null
          sources?: Json | null
          sponsorship_enabled?: boolean | null
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          supporting_count?: number
          tags?: string[] | null
          tips_enabled?: boolean | null
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Update: {
          allow_inline_comments?: boolean | null
          author_id?: string
          canonical_thesis?: string | null
          challenging_count?: number
          cover_image_url?: string | null
          created_at?: string
          id?: string
          inquiring_count?: number
          is_nsfw?: boolean | null
          mode_config?: Json | null
          org_id?: string | null
          published_at?: string | null
          repost_credits_required?: boolean | null
          reposted_from?: string | null
          scheduled_for?: string | null
          slug?: string | null
          source_url?: string | null
          sources?: Json | null
          sponsorship_enabled?: boolean | null
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          supporting_count?: number
          tags?: string[] | null
          tips_enabled?: boolean | null
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_objects_author_id_profiles_id_fk"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_objects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_objects_reposted_from_fkey"
            columns: ["reposted_from"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_objects_workspace_id_workspaces_id_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          content_object_id: string
          created_at: string
          id: string
          reason: string
          status: string
          target_id: string | null
          target_type: string | null
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          content_object_id: string
          created_at?: string
          id?: string
          reason: string
          status?: string
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Update: {
          content_object_id?: string
          created_at?: string
          id?: string
          reason?: string
          status?: string
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_content_object_id_fkey"
            columns: ["content_object_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_quests: {
        Row: {
          completed_at: string
          id: string
          points_awarded: number | null
          quest_key: string | null
          quest_type: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          completed_at?: string
          id?: string
          points_awarded?: number | null
          quest_key?: string | null
          quest_type: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          points_awarded?: number | null
          quest_key?: string | null
          quest_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_quests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_messages: {
        Row: {
          body: string
          created_at: string | null
          id: string
          room_id: string | null
          stance: string
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          room_id?: string | null
          stance: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          room_id?: string | null
          stance?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debate_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "debate_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_room_invites: {
        Row: {
          created_at: string | null
          id: string
          room_id: string | null
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          id?: string
          room_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          room_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debate_room_invites_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "debate_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_room_invites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_rooms: {
        Row: {
          access_mode: string
          branch_id: string | null
          content_object_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_public: boolean | null
          org_id: string | null
          prompt: string | null
          required_tier_id: string | null
          title: string
        }
        ComputedFields: never
        Insert: {
          access_mode?: string
          branch_id?: string | null
          content_object_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_public?: boolean | null
          org_id?: string | null
          prompt?: string | null
          required_tier_id?: string | null
          title: string
        }
        Update: {
          access_mode?: string
          branch_id?: string | null
          content_object_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_public?: boolean | null
          org_id?: string | null
          prompt?: string | null
          required_tier_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "debate_rooms_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_rooms_content_object_id_fkey"
            columns: ["content_object_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_rooms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_rooms_required_tier_id_fkey"
            columns: ["required_tier_id"]
            isOneToOne: false
            referencedRelation: "membership_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      dmca_counter_notices: {
        Row: {
          author_id: string
          consent_jurisdiction: boolean
          contact: string
          created_at: string
          good_faith: boolean
          id: string
          notice_id: string
          restore_eligible_at: string
          restored_at: string | null
          signature: string
          statement: string
          status: string
        }
        ComputedFields: never
        Insert: {
          author_id: string
          consent_jurisdiction: boolean
          contact: string
          created_at?: string
          good_faith: boolean
          id?: string
          notice_id: string
          restore_eligible_at: string
          restored_at?: string | null
          signature: string
          statement: string
          status?: string
        }
        Update: {
          author_id?: string
          consent_jurisdiction?: boolean
          contact?: string
          created_at?: string
          good_faith?: boolean
          id?: string
          notice_id?: string
          restore_eligible_at?: string
          restored_at?: string | null
          signature?: string
          statement?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dmca_counter_notices_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dmca_counter_notices_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "dmca_notices"
            referencedColumns: ["id"]
          },
        ]
      }
      dmca_notices: {
        Row: {
          accuracy_statement: boolean
          actioned_at: string | null
          actioned_by: string | null
          admin_note: string | null
          complainant_address: string
          complainant_email: string
          complainant_name: string
          complainant_role: string
          created_at: string
          good_faith_statement: boolean
          id: string
          infringing_urls: string[]
          notice_type: string
          signature: string
          status: string
          target_content_object_id: string | null
          work_identification: string
        }
        ComputedFields: never
        Insert: {
          accuracy_statement: boolean
          actioned_at?: string | null
          actioned_by?: string | null
          admin_note?: string | null
          complainant_address: string
          complainant_email: string
          complainant_name: string
          complainant_role: string
          created_at?: string
          good_faith_statement: boolean
          id?: string
          infringing_urls: string[]
          notice_type: string
          signature: string
          status?: string
          target_content_object_id?: string | null
          work_identification: string
        }
        Update: {
          accuracy_statement?: boolean
          actioned_at?: string | null
          actioned_by?: string | null
          admin_note?: string | null
          complainant_address?: string
          complainant_email?: string
          complainant_name?: string
          complainant_role?: string
          created_at?: string
          good_faith_statement?: boolean
          id?: string
          infringing_urls?: string[]
          notice_type?: string
          signature?: string
          status?: string
          target_content_object_id?: string | null
          work_identification?: string
        }
        Relationships: [
          {
            foreignKeyName: "dmca_notices_target_content_object_id_fkey"
            columns: ["target_content_object_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      earnings_ledger: {
        Row: {
          created_at: string | null
          gross_paise: number | null
          id: string
          net_paise: number | null
          source: string | null
          status: string | null
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          gross_paise?: number | null
          id?: string
          net_paise?: number | null
          source?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          gross_paise?: number | null
          id?: string
          net_paise?: number | null
          source?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "earnings_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_unsubscribes: {
        Row: {
          author_id: string | null
          created_at: string
          email: string
          id: string
        }
        ComputedFields: never
        Insert: {
          author_id?: string | null
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_unsubscribes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          created_at: string
          id: string
          message: string
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          message: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          author_id: string
          created_at: string
          follower_id: string
          id: string
        }
        ComputedFields: never
        Insert: {
          author_id: string
          created_at?: string
          follower_id: string
          id?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          follower_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      insight_points: {
        Row: {
          created_at: string
          id: string
          points: number
          purchased_points: number
          reason: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          points?: number
          purchased_points?: number
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          purchased_points?: number
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insight_points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string | null
          details: string | null
          email: string
          expected_seats: string | null
          full_name: string
          id: string
          intent: string
          organization_name: string
          phone_number: string | null
          status: string
          timeline: string | null
          updated_at: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          details?: string | null
          email: string
          expected_seats?: string | null
          full_name: string
          id?: string
          intent: string
          organization_name: string
          phone_number?: string | null
          status?: string
          timeline?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          details?: string | null
          email?: string
          expected_seats?: string | null
          full_name?: string
          id?: string
          intent?: string
          organization_name?: string
          phone_number?: string | null
          status?: string
          timeline?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      membership_tiers: {
        Row: {
          author_id: string | null
          created_at: string
          description: string | null
          features: string[] | null
          icon: string | null
          id: string
          is_popular: boolean | null
          name: string
          perks: string[] | null
          price_cents: number | null
          price_monthly: number
          razorpay_plan_id: string | null
          workspace_id: string
        }
        ComputedFields: never
        Insert: {
          author_id?: string | null
          created_at?: string
          description?: string | null
          features?: string[] | null
          icon?: string | null
          id?: string
          is_popular?: boolean | null
          name: string
          perks?: string[] | null
          price_cents?: number | null
          price_monthly?: number
          razorpay_plan_id?: string | null
          workspace_id: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          description?: string | null
          features?: string[] | null
          icon?: string | null
          id?: string
          is_popular?: boolean | null
          name?: string
          perks?: string[] | null
          price_cents?: number | null
          price_monthly?: number
          razorpay_plan_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_tiers_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_tiers_workspace_id_workspaces_id_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          author_id: string | null
          id: string
          started_at: string
          status: string
          tier_id: string | null
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          author_id?: string | null
          id?: string
          started_at?: string
          status?: string
          tier_id?: string | null
          user_id?: string | null
        }
        Update: {
          author_id?: string | null
          id?: string
          started_at?: string
          status?: string
          tier_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "membership_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action: string
          content_object_id: string | null
          created_at: string | null
          id: string
          moderator_id: string
          reason: string | null
          report_id: string | null
        }
        ComputedFields: never
        Insert: {
          action: string
          content_object_id?: string | null
          created_at?: string | null
          id?: string
          moderator_id: string
          reason?: string | null
          report_id?: string | null
        }
        Update: {
          action?: string
          content_object_id?: string | null
          created_at?: string | null
          id?: string
          moderator_id?: string
          reason?: string | null
          report_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_content_object_id_fkey"
            columns: ["content_object_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "content_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_dispatches: {
        Row: {
          author_id: string
          created_at: string
          id: string
          piece_id: string
          recipient_count: number
          status: string
          subject: string
        }
        ComputedFields: never
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          piece_id: string
          recipient_count?: number
          status?: string
          subject: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          piece_id?: string
          recipient_count?: number
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_dispatches_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_dispatches_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          payload: NonNullable<Json>
          read_at: string | null
          type: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          payload?: NonNullable<Json>
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: NonNullable<Json>
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          org_id: string
          role: string
          token: string
        }
        ComputedFields: never
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          org_id: string
          role?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          org_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_subscriptions: {
        Row: {
          created_at: string
          id: string
          org_id: string
          plan: string
          seats: number
          status: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          plan: string
          seats: number
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          plan?: string
          seats?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_workspaces: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
          slug: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_workspaces_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          plan: string
          seats: number
          slug: string
          type: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          plan?: string
          seats?: number
          slug: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          plan?: string
          seats?: number
          slug?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_subscriptions: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          razorpay_subscription_id: string
          status: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          razorpay_subscription_id: string
          status: string
          user_id: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          razorpay_subscription_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_subscriptions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_methods: {
        Row: {
          account_name: string | null
          account_number: string | null
          created_at: string
          id: string
          ifsc: string | null
          is_default: boolean
          method_type: string
          pan: string | null
          razorpayx_contact_id: string | null
          razorpayx_fund_account_id: string | null
          status: string
          user_id: string
          vpa: string | null
        }
        ComputedFields: never
        Insert: {
          account_name?: string | null
          account_number?: string | null
          created_at?: string
          id?: string
          ifsc?: string | null
          is_default?: boolean
          method_type: string
          pan?: string | null
          razorpayx_contact_id?: string | null
          razorpayx_fund_account_id?: string | null
          status?: string
          user_id: string
          vpa?: string | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          created_at?: string
          id?: string
          ifsc?: string | null
          is_default?: boolean
          method_type?: string
          pan?: string | null
          razorpayx_contact_id?: string | null
          razorpayx_fund_account_id?: string | null
          status?: string
          user_id?: string
          vpa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          amount_paise: number | null
          created_at: string | null
          destination: string | null
          failure_reason: string | null
          id: string
          payout_method_id: string | null
          processed_at: string | null
          processed_by: string | null
          reference: string | null
          status: string
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          amount_paise?: number | null
          created_at?: string | null
          destination?: string | null
          failure_reason?: string | null
          id?: string
          payout_method_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reference?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          amount_paise?: number | null
          created_at?: string | null
          destination?: string | null
          failure_reason?: string | null
          id?: string
          payout_method_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reference?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_payout_method_id_fkey"
            columns: ["payout_method_id"]
            isOneToOne: false
            referencedRelation: "payout_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      piece_claps: {
        Row: {
          count: number
          created_at: string
          id: string
          piece_id: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          count?: number
          created_at?: string
          id?: string
          piece_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          piece_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "piece_claps_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piece_claps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      piece_coauthors: {
        Row: {
          created_at: string
          id: string
          piece_id: string
          role: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          piece_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          piece_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "piece_coauthors_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piece_coauthors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      piece_crdt: {
        Row: {
          piece_id: string
          state: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          piece_id: string
          state: string
          updated_at?: string
        }
        Update: {
          piece_id?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "piece_crdt_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: true
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      piece_response_votes: {
        Row: {
          created_at: string
          id: string
          response_id: string
          user_id: string
          vote_type: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          response_id: string
          user_id: string
          vote_type: number
        }
        Update: {
          created_at?: string
          id?: string
          response_id?: string
          user_id?: string
          vote_type?: number
        }
        Relationships: [
          {
            foreignKeyName: "piece_response_votes_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "piece_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piece_response_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      piece_responses: {
        Row: {
          body: string
          created_at: string
          id: string
          is_pinned: boolean
          parent_id: string | null
          piece_id: string
          quoted_text: string | null
          serialized_range: Json | null
          sources: Json | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          parent_id?: string | null
          piece_id: string
          quoted_text?: string | null
          serialized_range?: Json | null
          sources?: Json | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          parent_id?: string | null
          piece_id?: string
          quoted_text?: string | null
          serialized_range?: Json | null
          sources?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "piece_responses_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "piece_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piece_responses_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piece_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      piece_versions: {
        Row: {
          author_id: string
          blocks_snapshot: NonNullable<Json>
          created_at: string
          id: string
          is_auto: boolean | null
          message: string | null
          piece_id: string
        }
        ComputedFields: never
        Insert: {
          author_id: string
          blocks_snapshot: NonNullable<Json>
          created_at?: string
          id?: string
          is_auto?: boolean | null
          message?: string | null
          piece_id: string
        }
        Update: {
          author_id?: string
          blocks_snapshot?: NonNullable<Json>
          created_at?: string
          id?: string
          is_auto?: boolean | null
          message?: string | null
          piece_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "piece_versions_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          byok_api_key: string | null
          byok_model: string | null
          byok_provider: string | null
          created_at: string
          credits: number | null
          custom_domain: string | null
          date_of_birth: string | null
          disability_cognitive: boolean | null
          disability_hearing: boolean | null
          disability_motor: boolean | null
          disability_visual: boolean | null
          display_name: string | null
          flair: string | null
          flair_owned: string[] | null
          handle: string | null
          id: string
          level: number | null
          nsfw_enabled: boolean | null
          plan: string | null
          restricted_reason: string | null
          restricted_until: string | null
          strikes: number
          stripe_customer_id: string | null
          studio_credit_until: string | null
          updated_at: string
          xp: number | null
        }
        ComputedFields: never
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          byok_api_key?: string | null
          byok_model?: string | null
          byok_provider?: string | null
          created_at?: string
          credits?: number | null
          custom_domain?: string | null
          date_of_birth?: string | null
          disability_cognitive?: boolean | null
          disability_hearing?: boolean | null
          disability_motor?: boolean | null
          disability_visual?: boolean | null
          display_name?: string | null
          flair?: string | null
          flair_owned?: string[] | null
          handle?: string | null
          id: string
          level?: number | null
          nsfw_enabled?: boolean | null
          plan?: string | null
          restricted_reason?: string | null
          restricted_until?: string | null
          strikes?: number
          stripe_customer_id?: string | null
          studio_credit_until?: string | null
          updated_at?: string
          xp?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          byok_api_key?: string | null
          byok_model?: string | null
          byok_provider?: string | null
          created_at?: string
          credits?: number | null
          custom_domain?: string | null
          date_of_birth?: string | null
          disability_cognitive?: boolean | null
          disability_hearing?: boolean | null
          disability_motor?: boolean | null
          disability_visual?: boolean | null
          display_name?: string | null
          flair?: string | null
          flair_owned?: string[] | null
          handle?: string | null
          id?: string
          level?: number | null
          nsfw_enabled?: boolean | null
          plan?: string | null
          restricted_reason?: string | null
          restricted_until?: string | null
          strikes?: number
          stripe_customer_id?: string | null
          studio_credit_until?: string | null
          updated_at?: string
          xp?: number | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_paise: number
          author_id: string | null
          bundle_id: string | null
          content_object_id: string | null
          created_at: string
          currency: string | null
          id: string
          item_id: string
          item_type: string
          kind: string | null
          net_paise: number | null
          razorpay_order_id: string
          razorpay_payment_id: string | null
          status: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          amount_paise: number
          author_id?: string | null
          bundle_id?: string | null
          content_object_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          item_id: string
          item_type: string
          kind?: string | null
          net_paise?: number | null
          razorpay_order_id: string
          razorpay_payment_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          author_id?: string | null
          bundle_id?: string | null
          content_object_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          item_id?: string
          item_type?: string
          kind?: string | null
          net_paise?: number | null
          razorpay_order_id?: string
          razorpay_payment_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_content_object_id_fkey"
            columns: ["content_object_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quests: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          quest_type: string
          reward_credits: number | null
          reward_xp: number | null
          stat_key: string
          target_value: number
          title: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          quest_type: string
          reward_credits?: number | null
          reward_xp?: number | null
          stat_key: string
          target_value: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          quest_type?: string
          reward_credits?: number | null
          reward_xp?: number | null
          stat_key?: string
          target_value?: number
          title?: string
        }
        Relationships: []
      }
      reader_annotations: {
        Row: {
          created_at: string
          highlight_id: string
          id: string
          note: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          highlight_id: string
          id?: string
          note: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          highlight_id?: string
          id?: string
          note?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reader_annotations_highlight_id_fkey"
            columns: ["highlight_id"]
            isOneToOne: false
            referencedRelation: "reader_highlights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reader_annotations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reader_highlights: {
        Row: {
          block_id: string | null
          created_at: string
          id: string
          piece_id: string
          text_content: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          block_id?: string | null
          created_at?: string
          id?: string
          piece_id: string
          text_content: string
          updated_at?: string
          user_id: string
        }
        Update: {
          block_id?: string | null
          created_at?: string
          id?: string
          piece_id?: string
          text_content?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reader_highlights_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reader_highlights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reader_pool_distributions: {
        Row: {
          amount_paise: number
          created_at: string
          creator_id: string
          id: string
          period_end: string
          reader_id: string
          weight: number
        }
        ComputedFields: never
        Insert: {
          amount_paise: number
          created_at?: string
          creator_id: string
          id?: string
          period_end: string
          reader_id: string
          weight?: number
        }
        Update: {
          amount_paise?: number
          created_at?: string
          creator_id?: string
          id?: string
          period_end?: string
          reader_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "reader_pool_distributions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reader_pool_distributions_reader_id_fkey"
            columns: ["reader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reader_subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          id: string
          ip_granted_until: string | null
          pool_settled_until: string | null
          razorpay_plan_id: string
          razorpay_subscription_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          ip_granted_until?: string | null
          pool_settled_until?: string | null
          razorpay_plan_id: string
          razorpay_subscription_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          ip_granted_until?: string | null
          pool_settled_until?: string | null
          razorpay_plan_id?: string
          razorpay_subscription_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reader_telemetry: {
        Row: {
          content_object_id: string
          created_at: string
          dwell_time_seconds: number
          id: string
          mode: string
          scroll_depth: number
          session_id: string
        }
        ComputedFields: never
        Insert: {
          content_object_id: string
          created_at?: string
          dwell_time_seconds?: number
          id?: string
          mode: string
          scroll_depth?: number
          session_id: string
        }
        Update: {
          content_object_id?: string
          created_at?: string
          dwell_time_seconds?: number
          id?: string
          mode?: string
          scroll_depth?: number
          session_id?: string
        }
        Relationships: []
      }
      reading_streaks: {
        Row: {
          current_streak: number
          id: string
          last_read_at: string
          last_read_date: string | null
          longest_streak: number | null
          updated_at: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          current_streak?: number
          id?: string
          last_read_at?: string
          last_read_date?: string | null
          longest_streak?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          current_streak?: number
          id?: string
          last_read_at?: string
          last_read_date?: string | null
          longest_streak?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_feedback: {
        Row: {
          created_at: string
          id: string
          is_like: boolean
          piece_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          is_like: boolean
          piece_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_like?: boolean
          piece_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_feedback_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          blurb: string | null
          created_at: string
          id: string
          recommended_id: string
          recommender_id: string
        }
        ComputedFields: never
        Insert: {
          blurb?: string | null
          created_at?: string
          id?: string
          recommended_id: string
          recommender_id: string
        }
        Update: {
          blurb?: string | null
          created_at?: string
          id?: string
          recommended_id?: string
          recommender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_recommended_id_fkey"
            columns: ["recommended_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_recommender_id_fkey"
            columns: ["recommender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      relationships: {
        Row: {
          created_at: string
          from_object_id: string
          id: string
          to_object_id: string
          type: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          from_object_id: string
          id?: string
          to_object_id: string
          type: string
        }
        Update: {
          created_at?: string
          from_object_id?: string
          id?: string
          to_object_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationships_from_object_id_fkey"
            columns: ["from_object_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_to_object_id_fkey"
            columns: ["to_object_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      restriction_appeals: {
        Row: {
          created_at: string | null
          id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          id?: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restriction_appeals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restriction_appeals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saves: {
        Row: {
          collection_id: string | null
          content_object_id: string | null
          created_at: string | null
          id: string
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          collection_id?: string | null
          content_object_id?: string | null
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          collection_id?: string | null
          content_object_id?: string | null
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saves_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saves_content_object_id_fkey"
            columns: ["content_object_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsorships: {
        Row: {
          content_object_id: string | null
          created_at: string | null
          disclosure_text: string | null
          ends_at: string | null
          id: string
          sponsor_logo_url: string | null
          sponsor_name: string
          sponsor_url: string | null
          status: string
        }
        ComputedFields: never
        Insert: {
          content_object_id?: string | null
          created_at?: string | null
          disclosure_text?: string | null
          ends_at?: string | null
          id?: string
          sponsor_logo_url?: string | null
          sponsor_name: string
          sponsor_url?: string | null
          status?: string
        }
        Update: {
          content_object_id?: string | null
          created_at?: string | null
          disclosure_text?: string | null
          ends_at?: string | null
          id?: string
          sponsor_logo_url?: string | null
          sponsor_name?: string
          sponsor_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsorships_content_object_id_fkey"
            columns: ["content_object_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_subscriptions: {
        Row: {
          id: string
          started_at: string
          status: string
          subscriber_id: string
          tier_id: string
        }
        ComputedFields: never
        Insert: {
          id?: string
          started_at?: string
          status: string
          subscriber_id: string
          tier_id: string
        }
        Update: {
          id?: string
          started_at?: string
          status?: string
          subscriber_id?: string
          tier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_subscriptions_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_subscriptions_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "membership_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          status: string
          stripe_subscription_id: string | null
          tier_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          status?: string
          stripe_subscription_id?: string | null
          tier_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          status?: string
          stripe_subscription_id?: string | null
          tier_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_tier_id_membership_tiers_id_fk"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "membership_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tds_withholdings: {
        Row: {
          created_at: string
          gross_paise: number
          id: string
          net_paise: number
          payout_id: string
          quarter: string
          tds_paise: number
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          gross_paise: number
          id?: string
          net_paise: number
          payout_id: string
          quarter: string
          tds_paise: number
          user_id: string
        }
        Update: {
          created_at?: string
          gross_paise?: number
          id?: string
          net_paise?: number
          payout_id?: string
          quarter?: string
          tds_paise?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tds_withholdings_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payout_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tds_withholdings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telemetry_events: {
        Row: {
          content_object_id: string
          created_at: string
          depth: number | null
          event: string | null
          event_type: string
          id: string
          metadata: Json | null
          mode: string | null
          payload: Json | null
          piece_id: string
          session: string | null
        }
        ComputedFields: never
        Insert: {
          content_object_id: string
          created_at?: string
          depth?: number | null
          event?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          mode?: string | null
          payload?: Json | null
          piece_id: string
          session?: string | null
        }
        Update: {
          content_object_id?: string
          created_at?: string
          depth?: number | null
          event?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          mode?: string | null
          payload?: Json | null
          piece_id?: string
          session?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_events_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "content_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      tips: {
        Row: {
          amount_paise: number
          author_id: string | null
          created_at: string
          id: string
          net_paise: number
          razorpay_order_id: string
          razorpay_payment_id: string | null
          recipient_id: string
          sender_id: string | null
          status: string | null
        }
        ComputedFields: never
        Insert: {
          amount_paise: number
          author_id?: string | null
          created_at?: string
          id?: string
          net_paise: number
          razorpay_order_id: string
          razorpay_payment_id?: string | null
          recipient_id: string
          sender_id?: string | null
          status?: string | null
        }
        Update: {
          amount_paise?: number
          author_id?: string | null
          created_at?: string
          id?: string
          net_paise?: number
          razorpay_order_id?: string
          razorpay_payment_id?: string | null
          recipient_id?: string
          sender_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tips_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tips_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tips_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reward_claims: {
        Row: {
          claimed_at: string
          id: string
          item_id: string
          item_type: string
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          claimed_at?: string
          id?: string
          item_id: string
          item_type: string
          user_id?: string | null
        }
        Update: {
          claimed_at?: string
          id?: string
          item_id?: string
          item_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_reward_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stats: {
        Row: {
          created_at: string
          current_streak: number | null
          followers_count: number | null
          has_seen_newsletter_modal: boolean | null
          last_active_date: string | null
          longest_streak: number | null
          pieces_read: number | null
          pieces_written: number | null
          streak_broken_at: string | null
          streak_broken_value: number | null
          streak_restores_month: string | null
          streak_restores_used: number | null
          tips_received: number | null
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          current_streak?: number | null
          followers_count?: number | null
          has_seen_newsletter_modal?: boolean | null
          last_active_date?: string | null
          longest_streak?: number | null
          pieces_read?: number | null
          pieces_written?: number | null
          streak_broken_at?: string | null
          streak_broken_value?: number | null
          streak_restores_month?: string | null
          streak_restores_used?: number | null
          tips_received?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number | null
          followers_count?: number | null
          has_seen_newsletter_modal?: boolean | null
          last_active_date?: string | null
          longest_streak?: number | null
          pieces_read?: number | null
          pieces_written?: number | null
          streak_broken_at?: string | null
          streak_broken_value?: number | null
          streak_restores_month?: string | null
          streak_restores_used?: number | null
          tips_received?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        ComputedFields: never
        Insert: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_workspaces_id_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          slug: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_owner_id_profiles_id_fk"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_blocks: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          content: Json
          content_object_id: string
          id: string
          similarity: number
          type: string
        }[]
      }
    }
    Enums: {
      block_type:
        | "paragraph"
        | "heading"
        | "citation"
        | "code"
        | "chart"
        | "image"
        | "callout"
        | "question"
        | "exercise"
        | "discussion_anchor"
        | "audio_note"
        | "embed"
        | "quote"
        | "mermaid"
        | "flowchart"
      branch_type: "audio" | "teach" | "premium_update" | "debate" | "localized"
      content_status:
        "draft" | "scheduled" | "published" | "archived" | "deleted"
      relationship_type:
        | "supports"
        | "expands"
        | "rebuts"
        | "derives_from"
        | "teaches"
        | "included_in_bundle"
        | "discussed_in"
      visibility: "public" | "members_only" | "private" | "cohort"
      workspace_role: "owner" | "editor" | "contributor" | "reviewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      block_type: [
        "paragraph",
        "heading",
        "citation",
        "code",
        "chart",
        "image",
        "callout",
        "question",
        "exercise",
        "discussion_anchor",
        "audio_note",
        "embed",
        "quote",
        "mermaid",
        "flowchart",
      ],
      branch_type: ["audio", "teach", "premium_update", "debate", "localized"],
      content_status: [
        "draft",
        "scheduled",
        "published",
        "archived",
        "deleted",
      ],
      relationship_type: [
        "supports",
        "expands",
        "rebuts",
        "derives_from",
        "teaches",
        "included_in_bundle",
        "discussed_in",
      ],
      visibility: ["public", "members_only", "private", "cohort"],
      workspace_role: ["owner", "editor", "contributor", "reviewer"],
    },
  },
} as const
