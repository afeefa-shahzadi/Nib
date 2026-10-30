/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"
import { rzFetch } from "@/lib/razorpay/api"

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
        .select(
          "id, status, tier_id, author_id, started_at, sub:payment_subscriptions(current_period_end, cancel_at_period_end)"
        )
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
          sub: any
        }) => {
          const { sub: rawSub, ...rest } = m
          const sub = Array.isArray(rawSub) ? rawSub[0] : rawSub
          return {
            ...rest,
            period_end: (sub?.current_period_end ?? null) as string | null,
            ending: !!sub?.cancel_at_period_end,
            tier: tierMap.get(m.tier_id) ?? null,
            author: authorMap.get(m.author_id) ?? null,
          }
        }
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

// Cancel one of my memberships. A paid membership is cancelled at Razorpay at
// the end of the current period: the reader keeps access until then, and the
// webhook's subscription.cancelled closes the membership. One with no live
// subscription (free tier, or billing never set up) ends now.
export async function cancelMyMembership(
  args: { data?: any } = {}
): Promise<{ endsAt: string | null } | { error: string }> {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const userId = _auth?.user?.id
  if (!userId) return { error: "Sign in to continue." }
  const id = (args?.data as { membership_id?: string })?.membership_id

  const { data: m } = await supabaseAdmin
    .from("memberships")
    .select(
      "id, status, sub:payment_subscriptions(id, status, razorpay_subscription_id, current_period_end, cancel_at_period_end)"
    )
    .eq("id", id!)
    .eq("user_id", userId)
    .maybeSingle()
  if (!m || m.status !== "active")
    return { error: "This membership isn't active." }

  const sub = (Array.isArray(m.sub) ? m.sub[0] : m.sub) as {
    id: string
    status: string
    razorpay_subscription_id: string
    current_period_end: string | null
    cancel_at_period_end: boolean
  } | null
  if (sub && ["active", "authenticated"].includes(sub.status)) {
    if (!sub.cancel_at_period_end) {
      try {
        await rzFetch(`/subscriptions/${sub.razorpay_subscription_id}/cancel`, {
          method: "POST",
          body: JSON.stringify({ cancel_at_cycle_end: 1 }),
        })
      } catch (e) {
        console.error("[memberships] razorpay cancel failed", e)
        return {
          error: "Couldn't cancel with the payment provider. Try again.",
        }
      }
      await supabaseAdmin
        .from("payment_subscriptions")
        .update({ cancel_at_period_end: true })
        .eq("id", sub.id)
    }
    return { endsAt: sub.current_period_end }
  }

  const { error } = await supabaseAdmin
    .from("memberships")
    .update({ status: "canceled" })
    .eq("id", m.id)
  if (error) {
    console.error("[server]", error)
    return { error: "Couldn't cancel the membership. Try again." }
  }
  return { endsAt: null }
}
