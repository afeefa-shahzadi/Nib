/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"

// ---------- NOTIFICATIONS ----------
export async function listNotifications() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("id, type, payload, read_at, created_at")
      .eq("user_id", context.userId!)
      .order("created_at", { ascending: false })
      .limit(50)
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }

    const actorIds = new Set<string>()
    for (const n of data ?? []) {
      const p = (n.payload ?? {}) as Record<string, unknown>
      if (typeof p.follower_id === "string") actorIds.add(p.follower_id)
      if (typeof p.author_id === "string") actorIds.add(p.author_id)
      if (typeof p.sender_id === "string") actorIds.add(p.sender_id)
    }
    let actors: Record<string, { handle: string; display_name: string }> = {}
    if (actorIds.size > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, handle, display_name")
        .in("id", Array.from(actorIds))
      actors = Object.fromEntries(
        (profs ?? []).map(
          (p: { id: string; handle: string | null; display_name: string }) => [
            p.id,
            { handle: p.handle ?? "", display_name: p.display_name },
          ]
        )
      )
    }
    const { count: unread } = await context.supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", context.userId!)
      .is("read_at", null)

    return { notifications: data ?? [], actors, unread: unread ?? 0 }
  }
  return await __handler({ context })
}

export async function unreadCount() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    const { count } = await context.supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", context.userId!)
      .is("read_at", null)
    return { unread: count ?? 0 }
  }
  return await __handler({ context })
}

export async function markAllNotificationsRead() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId!)
      .is("read_at", null)
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { ok: true }
  }
  return await __handler({ context })
}

export async function markNotificationRead(args: { data?: any } = {}) {
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
    data: { id: string }
    context: ActionContext
  }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId!)
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { ok: true }
  }
  return await __handler({
    data: args?.data as { id: string },
    context,
  })
}
