/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"

// List my active memberships + subscriptions with tier/author detail
export async function listMyMemberships() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    const [{ data: memberships }, { data: subs }] = await Promise.all([
      supabaseAdmin
        .from("memberships")
        .select("id, status, tier_id, author_id, started_at")
        .eq("user_id", context.userId!)
        .order("started_at", { ascending: false }),
      supabaseAdmin
        .from("payment_subscriptions")
        .select(
          "id, status, tier_id, author_id, current_period_end, razorpay_subscription_id"
        )
        .eq("user_id", context.userId!),
    ])
    const tierIds = Array.from(
      new Set(
        [...(memberships ?? []), ...(subs ?? [])].map(
          (r: { tier_id: string }) => r.tier_id
        )
      )
    )
    const authorIds = Array.from(
      new Set(
        [...(memberships ?? []), ...(subs ?? [])].map(
          (r: { author_id: string }) => r.author_id
        )
      )
    )
    const [{ data: tiers }, { data: authors }] = await Promise.all([
      tierIds.length
        ? supabaseAdmin
            .from("membership_tiers")
            .select("id, name, price_cents")
            .in("id", tierIds)
        : Promise.resolve({ data: [] }),
      authorIds.length
        ? supabaseAdmin
            .from("profiles")
            .select("id, handle, display_name, avatar_url")
            .in("id", authorIds)
        : Promise.resolve({ data: [] }),
    ])
    const tierMap = new Map(
      (tiers ?? []).map(
        (t: { id: string; name: string; price_cents: number }) => [t.id, t]
      )
    )
    const authorMap = new Map(
      (authors ?? []).map(
        (a: {
          id: string
          handle: string | null
          display_name: string
          avatar_url: string | null
        }) => [a.id, a]
      )
    )
    return {
      memberships: (memberships ?? []).map(
        (m: {
          tier_id: string
          author_id: string
          status: string
          started_at: string
          id: string
        }) => ({
          ...m,
          tier: tierMap.get(m.tier_id) ?? null,
          author: authorMap.get(m.author_id) ?? null,
        })
      ),
      subscriptions: (subs ?? []).map(
        (s: {
          tier_id: string
          author_id: string
          status: string
          current_period_end: string
          id: string
          razorpay_subscription_id: string
        }) => ({
          ...s,
          tier: tierMap.get(s.tier_id) ?? null,
          author: authorMap.get(s.author_id) ?? null,
        })
      ),
    }
  }
  return await __handler({ context })
}

// Cancel an active membership (marks status canceled; payment provider remains)
export async function cancelMyMembership(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { membership_id: string }
    context: ActionContext
  }) => {
    const { error } = await context.supabase
      .from("memberships")
      .update({ status: "canceled" })
      .eq("id", data.membership_id)
      .eq("user_id", context.userId!)
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { ok: true }
  }
  return await __handler({
    data: args?.data as { membership_id: string },
    context,
  })
}
