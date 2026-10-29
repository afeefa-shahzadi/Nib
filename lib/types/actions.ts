import { User, SupabaseClient } from "@supabase/supabase-js"

export interface ActionContext {
  user: User | null
  userId: string | undefined
  supabase: SupabaseClient
}

export interface MembershipTier {
  id: string
  author_id: string
  name: string
  description: string | null
  price_cents: number
  perks: string[]
  razorpay_plan_id?: string | null
  created_at?: string
}
