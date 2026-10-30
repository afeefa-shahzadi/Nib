/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { insertNotifications } from "@/lib/activity-notifications"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"
import { checkRateLimit } from "@/lib/rate-limit.server"

// ---------- FOLLOW: counts + status ----------
export async function getFollowStatus(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()

  const __handler = async ({ data }: { data: { author_id: string } }) => {
    const { count } = await supabaseAdmin
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("author_id", data.author_id)
    return { followers: count ?? 0 }
  }
  return await __handler({ data: args?.data as { author_id: string } })
}

export async function isFollowing(args: { data?: any } = {}) {
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
    data: { author_id: string }
    context: ActionContext
  }) => {
    if (!context.userId) return { following: false }
    const { data: row } = await context.supabase
      .from("follows")
      .select("id")
      .eq("author_id", data.author_id)
      .eq("follower_id", context.userId!)
      .maybeSingle()
    return { following: !!row }
  }
  return await __handler({
    data: args?.data as { author_id: string },
    context,
  })
}

export async function followAuthor(args: { data?: any } = {}) {
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
    data: { author_id: string }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")
    if (data.author_id === context.userId)
      throw new Error("You can't follow yourself.")
    const rl = await checkRateLimit("follow", context.userId, 30, 3600)
    if (!rl.ok) throw new Error("You're following and unfollowing a lot. Try again later.")
    const { data: target } = await supabaseAdmin.from("profiles").select("id").eq("id", data.author_id).maybeSingle()
    if (!target) throw new Error("That writer doesn't exist.")
    // The follows insert fires a follower-count trigger that writes profiles;
    // under the cookie client (authenticated role) that write is grant-denied and
    // rolls back the whole insert, so the follow never persists. follower_id is
    // pinned to the verified caller, so running this as the service role is safe.
    const svc = supabaseAdmin
    const { error } = await svc
      .from("follows")
      .insert({ author_id: data.author_id, follower_id: context.userId! })
    if (error && !/duplicate key/i.test(error.message)) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    
    // Welcome email + notification only the first time this reader follows this
    // writer, so follow/unfollow loops can't spam either of them.
    const { count: notifiedBefore } = error
      ? { count: 1 }
      : await svc
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", data.author_id)
          .eq("type", "new_follower")
          .eq("payload->>follower_id", context.userId)
    if (!error && !notifiedBefore) {
      try {
        // notifications has no INSERT policy by design (system-written only);
        // write with the service role (reused from the insert above).
        await insertNotifications(svc, [{
          user_id: data.author_id,
          type: "new_follower",
          payload: { follower_id: context.userId! },
        }])

        // Fetch author details
        const { data: author } = await context.supabase
          .from("profiles")
          .select("display_name, handle")
          .eq("id", data.author_id)
          .single()

        // 1. Send "Successfully Subscribed" email
        // Skipped when the reader turned off Nib emails (Settings > Notifications).
        const { data: optedOut } = context.user?.email
          ? await svc
              .from("email_unsubscribes")
              .select("email")
              .eq("email", context.user.email.toLowerCase())
              .is("author_id", null)
              .maybeSingle()
          : { data: null }
        if (author && context.user?.email && !optedOut) {
          const { sendSubscriptionEmail } = await import("@/lib/email")
          await sendSubscriptionEmail({
            authorName: author.display_name,
            authorHandle: author.handle,
            recipientEmail: context.user.email,
          })
        }

        // 2. Automatically assign subscriptions toward the best revenue strategy
        // Find if the author has a 'free' or entry-level tier and auto-enroll the follower
        const { data: tiers } = await context.supabase
          .from("membership_tiers")
          .select("id, price_cents")
          .eq("author_id", data.author_id)
          .order("price_cents", { ascending: true })
          .limit(1)

        if (tiers && tiers.length > 0) {
          const entryTier = tiers[0]
          // Only auto-enroll if it's free, otherwise they need to pay
          if (entryTier.price_cents === 0) {
            await context.supabase.from("studio_subscriptions").insert({
              subscriber_id: context.userId,
              tier_id: entryTier.id,
              status: "active",
            }).select().maybeSingle()
            // Ignore conflict errors if already enrolled
          }
        }
      } catch (e) {
        console.error("Failed to process follow hooks:", e)
      }
    }

    if (!error) {
      const { tickQuest } = await import("@/lib/quests.server")
      await tickQuest(context.userId!, "follow_1")
    }
    return { ok: true }
  }
  return await __handler({
    data: args?.data as { author_id: string },
    context,
  })
}

export async function unfollowAuthor(args: { data?: any } = {}) {
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
    data: { author_id: string }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Sign in first.")
    const rl = await checkRateLimit("follow", context.userId, 30, 3600)
    if (!rl.ok) throw new Error("You're following and unfollowing a lot. Try again later.")
    // Same follower-count trigger as follow: route the delete through the service
    // role so the trigger's profiles write isn't grant-denied. Scoped to the
    // verified caller's own follow row.
    const svc = supabaseAdmin
    const { error } = await svc
      .from("follows")
      .delete()
      .eq("author_id", data.author_id)
      .eq("follower_id", context.userId!)
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { ok: true }
  }
  return await __handler({
    data: args?.data as { author_id: string },
    context,
  })
}

// ---------- FOLLOW: list followers / following ----------
export async function listFollowers(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()

  const __handler = async ({ data }: { data: { author_id: string } }) => {
    const { data: rows } = await supabaseAdmin
      .from("follows")
      .select("follower_id, created_at")
      .eq("author_id", data.author_id)
      .order("created_at", { ascending: false })
      .limit(100)
    const ids = (rows ?? []).map((r: { follower_id: string }) => r.follower_id)
    if (ids.length === 0) return { followers: [] }
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, handle, display_name, avatar_url, bio")
      .in("id", ids)
    const map = new Map(
      (profs ?? []).map(
        (p: {
          id: string
          handle: string | null
          display_name: string
          avatar_url: string | null
          bio: string | null
        }) => [p.id, p]
      )
    )
    return { followers: ids.map((id: string) => map.get(id)).filter(Boolean) }
  }
  return await __handler({ data: args?.data as { author_id: string } })
}

export async function listFollowing(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()

  const __handler = async ({ data }: { data: { follower_id: string } }) => {
    const { data: rows } = await supabaseAdmin
      .from("follows")
      .select("author_id, created_at")
      .eq("follower_id", data.follower_id)
      .order("created_at", { ascending: false })
      .limit(100)
    const ids = (rows ?? []).map((r: { author_id: string }) => r.author_id)
    if (ids.length === 0) return { following: [] }
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, handle, display_name, avatar_url, bio")
      .in("id", ids)
    const map = new Map(
      (profs ?? []).map(
        (p: {
          id: string
          handle: string | null
          display_name: string
          avatar_url: string | null
          bio: string | null
        }) => [p.id, p]
      )
    )
    return { following: ids.map((id: string) => map.get(id)).filter(Boolean) }
  }
  return await __handler({ data: args?.data as { follower_id: string } })
}
