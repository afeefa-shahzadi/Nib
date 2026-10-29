/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"

// ---------- INLINE AUTOCOMPLETE ----------
export async function searchProfilesForMention(args: { data?: any } = {}) {
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
    data: { q: string; limit?: number }
    context: ActionContext
  }) => {
    const limit = data.limit ?? 6
    const like = `%${data.q.replace(/[%_]/g, "")}%`
    const { data: rows, error } = await context.supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url")
      .or(`handle.ilike.${like},display_name.ilike.${like}`)
      .limit(limit)
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return rows ?? []
  }
  return await __handler({
    data: args?.data as { q: string; limit?: number },
    context,
  })
}

export async function searchMyPiecesForLink(args: { data?: any } = {}) {
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
    data: { q: string; limit?: number }
    context: ActionContext
  }) => {
    const limit = data.limit ?? 6
    const like = `%${data.q.replace(/[%_]/g, "")}%`
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("handle")
      .eq("id", context.userId!)
      .single()
    const handle = prof?.handle ?? "me"
    const { data: rows, error } = await context.supabase
      .from("content_objects")
      .select("id, title, slug, status")
      .eq("author_id", context.userId!)
      .ilike("title", like)
      .order("updated_at", { ascending: false })
      .limit(limit)
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return (rows ?? []).map(
      (r: { id: string; title: string; slug: string; status: string }) => ({
        ...r,
        handle,
      })
    )
  }
  return await __handler({
    data: args?.data as { q: string; limit?: number },
    context,
  })
}

// ---------- PROFILE HOVER CARD ----------
export async function getProfileCard(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()

  const __handler = async ({ data }: { data: { handle: string } }) => {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id, handle, display_name, avatar_url, bio")
      .eq("handle", data.handle.toLowerCase())
      .maybeSingle()
    if (!prof) return null
    const [{ count: followers }, { count: pieces }] = await Promise.all([
      supabaseAdmin
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("author_id", prof.id),
      supabaseAdmin
        .from("content_objects")
        .select("*", { count: "exact", head: true })
        .eq("author_id", prof.id)
        .eq("status", "published")
        .eq("visibility", "public"),
    ])
    return { ...prof, followers: followers ?? 0, pieces: pieces ?? 0 }
  }
  return await __handler({ data: args?.data as { handle: string } })
}
