/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { excludeNsfw } from "@/lib/nsfw"
import { ActionContext } from "@/lib/types/actions"

// ---------- FEED ----------
export async function getFollowingFeed() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    const { data: follows } = await context.supabase
      .from("follows")
      .select("author_id")
      .eq("follower_id", context.userId!)
    const authorIds = (follows ?? []).map(
      (f: { author_id: string }) => f.author_id
    )
    // date_of_birth is a sensitive, service-role-only column; reading it via the
    // cookie client runs as `authenticated` and is grant-denied, silently forcing
    // the NSFW age-gate closed for every viewer. Read with the true service role,
    // scoped to the verified viewer id.
    const svc = supabaseAdmin
    const { data: profile } = await svc
      .from("profiles")
      .select("nsfw_enabled, date_of_birth")
      .eq("id", context.userId!)
      .maybeSingle()
    const nsfwEnabled = profile?.nsfw_enabled === true
    let isAdult = false
    if (profile?.date_of_birth) {
      const dob = new Date(profile.date_of_birth)
      const age = new Date().getFullYear() - dob.getFullYear()
      isAdult = age >= 18
    }

    if (authorIds.length === 0) return { pieces: [], empty: true as const }
    let query = supabaseAdmin
      .from("content_objects")
      .select("id, title, slug, summary, tags, published_at, author_id, cover_image_url, is_nsfw")
      .in("author_id", authorIds)
      .eq("status", "published")
      .eq("visibility", "public")
      .order("published_at", { ascending: false })
      .limit(50)
      
    if (!nsfwEnabled || !isAdult) {
      query = excludeNsfw(query)
    }

    const { data: pieces } = await query
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, handle, display_name, avatar_url")
      .in("id", authorIds)
    const map = new Map(
      (profs ?? []).map(
        (p: {
          id: string
          handle: string | null
          display_name: string
          avatar_url: string | null
        }) => [p.id, p]
      )
    )
    return {
      empty: false as const,
      pieces: (pieces ?? []).map(
        (p: {
          id: string
          title: string
          slug: string
          summary: string | null
          tags: string[] | null
          published_at: string | null
          author_id: string
          cover_image_url?: string | null
        }) => ({
          ...p,
          author: map.get(p.author_id) ?? null,
        })
      ),
    }
  }
  return await __handler({ context })
}

export async function getDiscoverFeed(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()

  const __handler = async ({ data }: { data?: { tag?: string; q?: string } }) => {
    // §3.5: discover/trending is a public discovery surface — NSFW is excluded
    // unconditionally, regardless of viewer opt-in (opt-in only applies to the
    // followed-authors feed above).
    let query = excludeNsfw(
      supabaseAdmin
        .from("content_objects")
        .select("id, title, slug, summary, tags, published_at, author_id, cover_image_url, is_nsfw")
        .eq("status", "published")
        .eq("visibility", "public")
        .order("published_at", { ascending: false })
        .limit(50)
    )

    if (data?.tag) query = query.contains("tags", [data.tag])

    if (data?.q) {
      // Strip characters that are syntax in a PostgREST `.or()` filter (commas,
      // parens, wildcards, backslash) so the query term can't inject extra
      // conditions or alter the ilike pattern.
      const q = data.q.replace(/[,()*\\%]/g, "")
      const { data: authors } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)

      const matchedAuthorIds = (authors ?? []).map((a) => a.id)
      const searchPattern = `%${q}%`
      
      if (matchedAuthorIds.length > 0) {
        query = query.or(
          `title.ilike.${searchPattern},summary.ilike.${searchPattern},author_id.in.(${matchedAuthorIds.join(",")})`
        )
      } else {
        query = query.or(`title.ilike.${searchPattern},summary.ilike.${searchPattern}`)
      }
    }

    const { data: pieces, error } = await query
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    const authorIds = Array.from(
      new Set((pieces ?? []).map((p: { author_id: string }) => p.author_id))
    )
    const { data: profs } = authorIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, handle, display_name, avatar_url")
          .in("id", authorIds)
      : {
          data: [] as {
            id: string
            handle: string
            display_name: string
            avatar_url: string | null
          }[],
        }
    const map = new Map(
      (profs ?? []).map(
        (p: {
          id: string
          handle: string | null
          display_name: string
          avatar_url: string | null
        }) => [p.id, p]
      )
    )

    const nowIso = new Date().toISOString()
    const { data: activeBoosts } = await supabaseAdmin
      .from("boosts")
      .select("content_object_id, amount_paise, ends_at")
      .eq("status", "active")
      .gt("ends_at", nowIso)
    const boostMap = new Map<string, number>()
    for (const b of activeBoosts ?? []) {
      boostMap.set(
        b.content_object_id,
        Math.max(boostMap.get(b.content_object_id) ?? 0, b.amount_paise)
      )
    }

    const enriched = (pieces ?? []).map(
      (p: {
        id: string
        title: string
        slug: string
        summary: string | null
        tags: string[] | null
        published_at: string | null
        author_id: string
      }) => ({
        ...p,
        author: map.get(p.author_id) ?? null,
        boosted: boostMap.has(p.id),
        boost_amount_paise: boostMap.get(p.id) ?? 0,
      })
    )
    enriched.sort((a, b) => {
      if (a.boosted !== b.boosted) return a.boosted ? -1 : 1
      if (a.boosted && b.boosted)
        return (b.boost_amount_paise ?? 0) - (a.boost_amount_paise ?? 0)
      return (b.published_at ?? "").localeCompare(a.published_at ?? "")
    })

    const tagCount = new Map<string, number>()
    for (const p of pieces ?? [])
      for (const t of p.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
    const trending = Array.from(tagCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count }))
    return { pieces: enriched, trending }
  }
  return await __handler({ data: args?.data as { tag?: string; q?: string } })
}
