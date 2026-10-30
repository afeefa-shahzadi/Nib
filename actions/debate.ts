/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { assertCanPost } from "@/lib/parental-consent"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"
import { enforceMentionPolicy } from "@/lib/mentions.server"
import { SupabaseClient } from "@supabase/supabase-js"
import { isLaunchFree } from "@/lib/plan"
import { notifyActivity } from "@/lib/activity-notifications"

type RoomAccess = {
  id: string
  is_public: boolean | null
  access_mode: string | null
  created_by: string | null
  org_id: string | null
  required_tier_id: string | null
}

// Admin client bypasses RLS, so gated-room access must be resolved here.
async function canAccessRoom(
  supabase: SupabaseClient,
  room: RoomAccess,
  userId: string | null
): Promise<boolean> {
  if (room.is_public || room.access_mode === "public") return true
  if (!userId) return false
  if (room.created_by === userId) return true
  if (room.access_mode === "invite") {
    const { data } = await supabase
      .from("debate_room_invites")
      .select("user_id")
      .eq("room_id", room.id)
      .eq("user_id", userId)
      .maybeSingle()
    return !!data
  }
  if (room.access_mode === "org" && room.org_id) {
    const { data } = await supabase
      .from("org_members")
      .select("user_id")
      .eq("org_id", room.org_id)
      .eq("user_id", userId)
      .maybeSingle()
    return !!data
  }
  if (room.access_mode === "tier" && room.required_tier_id) {
    if (isLaunchFree()) return true
    const { data } = await supabase
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("tier_id", room.required_tier_id)
      .eq("status", "active")
      .maybeSingle()
    return !!data
  }
  if (room.access_mode === "members" && room.created_by) {
    // Rooms are only opened by the piece's author, so created_by is the author.
    if (isLaunchFree()) return true
    const { data } = await supabase
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("author_id", room.created_by)
      .eq("status", "active")
      .limit(1)
      .maybeSingle()
    return !!data
  }
  return false
}

const ROOM_ACCESS_COLS =
  "id, title, prompt, access_mode, required_tier_id, branch_id, created_at, is_public, created_by, org_id, content_object_id, summary"

// PUBLIC: list rooms accessible to the caller for a piece
export async function listRoomsForPiece(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const userId = _auth?.user?.id ?? null

  const __handler = async ({
    data,
  }: {
    data: { content_object_id: string }
  }) => {
    const client = supabaseAdmin
    const { data: rooms, error } = await client
      .from("debate_rooms")
      .select(ROOM_ACCESS_COLS)
      .eq("content_object_id", data.content_object_id)
      .order("created_at", { ascending: false })
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    const accessible = []
    for (const room of rooms ?? []) {
      if (await canAccessRoom(client, room as RoomAccess, userId))
        accessible.push(room)
    }
    return accessible
  }
  return await __handler({ data: args?.data as { content_object_id: string } })
}

export async function listMessages(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const userId = _auth?.user?.id ?? null

  const __handler = async ({ data }: { data: { room_id: string } }) => {
    const client = supabaseAdmin
    const { data: room } = await client
      .from("debate_rooms")
      .select(ROOM_ACCESS_COLS)
      .eq("id", data.room_id)
      .maybeSingle()
    if (!room || !(await canAccessRoom(client, room as RoomAccess, userId)))
      throw new Error("Not authorized")
    const { data: msgs, error } = await client
      .from("debate_messages")
      .select("id, user_id, stance, body, created_at, block_id")
      .eq("room_id", data.room_id)
      .order("created_at", { ascending: true })
      .limit(500)
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    const userIds = Array.from(
      new Set((msgs ?? []).map((m: { user_id: string }) => m.user_id))
    )
    const { data: profiles } = userIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, handle, display_name, avatar_url")
          .in("id", userIds)
      : { data: [] }
    const map = new Map(
      (profiles ?? []).map(
        (p: { id: string; handle: string | null; display_name: string }) => [
          p.id,
          p,
        ]
      )
    )
    return (msgs ?? []).map(
      (m: {
        id: string
        user_id: string
        stance: string
        body: string
        created_at: string
        block_id: string | null
      }) => ({
        ...m,
        author: map.get(m.user_id) ?? null,
      })
    )
  }
  return await __handler({ data: args?.data as { room_id: string } })
}

// AUTHOR: create room (only piece author per RLS)
export async function createRoom(args: { data?: any } = {}) {
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
    data: {
      content_object_id: string
      branch_id?: string | null
      title: string
      prompt?: string | null
      access_mode: "public" | "tier" | "org" | "invite"
      required_tier_id?: string | null
      org_id?: string | null
      invite_user_ids?: string[]
    }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")
    await assertCanPost(context.userId)
    if (data.access_mode === "tier" && !data.required_tier_id) {
      throw new Error("required_tier_id is needed for tier-restricted rooms")
    }
    if (data.access_mode === "org" && !data.org_id) {
      throw new Error("org_id is required for org rooms")
    }
    // Only the piece's author may open a room on it. The admin client bypasses
    // RLS, so ownership must be checked in code (the "per RLS" comment did not
    // actually hold).
    const { data: piece } = await context.supabase
      .from("content_objects")
      .select("author_id")
      .eq("id", data.content_object_id)
      .maybeSingle()
    if (!piece || piece.author_id !== context.userId) {
      throw new Error("Not authorized")
    }
    if (data.access_mode === "org") {
      const { data: m } = await context.supabase
        .from("org_members")
        .select("user_id")
        .eq("org_id", data.org_id!)
        .eq("user_id", context.userId)
        .maybeSingle()
      if (!m) throw new Error("Not a member of that organization")
    }
    if (data.access_mode === "tier") {
      const { data: t } = await context.supabase
        .from("membership_tiers")
        .select("author_id")
        .eq("id", data.required_tier_id!)
        .maybeSingle()
      if (!t || t.author_id !== context.userId) throw new Error("Tier not found")
    }
    const { data: room, error } = await context.supabase
      .from("debate_rooms")
      .insert({
        content_object_id: data.content_object_id,
        branch_id: data.branch_id ?? null,
        title: data.title,
        prompt: data.prompt ?? null,
        is_public: data.access_mode === "public",
        access_mode: data.access_mode,
        required_tier_id:
          data.access_mode === "tier" ? data.required_tier_id! : null,
        org_id: data.access_mode === "org" ? data.org_id! : null,
        created_by: context.userId!,
      })
      .select("id")
      .single()
    if (error || !room) {
      console.error("[server]", error)
      throw new Error("Failed to create room")
    }

    if (data.access_mode === "invite" && data.invite_user_ids?.length) {
      const rows = data.invite_user_ids.map((uid) => ({
        room_id: room.id,
        user_id: uid,
      }))
      const { error: invErr } = await context.supabase
        .from("debate_room_invites")
        .insert(rows)
      if (invErr) {
        console.error("[server]", invErr)
        throw new Error("Request failed. Please try again.")
      }
    }
    return { ok: true, id: room.id }
  }
  return await __handler({
    data: args?.data as {
      content_object_id: string
      branch_id?: string | null
      title: string
      prompt?: string | null
      access_mode: "public" | "tier" | "org" | "invite"
      required_tier_id?: string | null
      org_id?: string | null
      invite_user_ids?: string[]
    },
    context,
  })
}

export async function deleteRoom(args: { data?: any } = {}) {
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
      .from("debate_rooms")
      .delete()
      .eq("id", data.id)
      .eq("created_by", context.userId!)
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

// AUTHENTICATED: post message (RLS gates this further)
export async function postMessage(args: { data?: any } = {}) {
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
    data: { room_id: string; stance: string; body: string; block_id?: string | null }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")
    await assertCanPost(context.userId)
    // Gate posting on room access. Admin client bypasses RLS, so the same
    // access rules used for reading must be enforced here before an insert.
    const { data: room } = await context.supabase
      .from("debate_rooms")
      .select(ROOM_ACCESS_COLS)
      .eq("id", data.room_id)
      .maybeSingle()
    if (
      !room ||
      !(await canAccessRoom(context.supabase, room as RoomAccess, context.userId))
    ) {
      throw new Error("Not authorized")
    }
    const blockId = data.block_id || null
    if (blockId) {
      const free = await freeBlocks(context.supabase, (room as { content_object_id: string }).content_object_id)
      if (!free.some((b) => b.id === blockId))
        throw new Error("That paragraph isn't part of this piece")
    }
    const body = await enforceMentionPolicy(context.supabase, data.body, context.userId!)
    const { error } = await context.supabase.from("debate_messages").insert({
      room_id: data.room_id,
      user_id: context.userId,
      stance: data.stance,
      body,
      block_id: blockId,
    })
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    await notifyActivity(context.supabase, {
      actorId: context.userId,
      pieceId: (room as { content_object_id: string }).content_object_id,
      html: body,
      anchor: `#room-${data.room_id}`,
    })
    return { ok: true }
  }
  return await __handler({
    data: args?.data as { room_id: string; stance: string; body: string; block_id?: string | null },
    context,
  })
}

// A piece's free paragraphs with a short excerpt each. Paid blocks are left
// out so a room never leaks text behind the paywall.
async function freeBlocks(supabase: SupabaseClient, contentObjectId: string) {
  const { data } = await supabase
    .from("blocks")
    .select("id, content, monetization_eligible")
    .eq("content_object_id", contentObjectId)
    .order("order", { ascending: true })
  return ((data ?? []) as { id: string; content: Record<string, unknown>; monetization_eligible: boolean | null }[])
    .filter((b) => !b.monetization_eligible)
    .map((b) => {
      const raw = typeof b.content?.text === "string" ? b.content.text : typeof b.content?.html === "string" ? b.content.html : ""
      const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      return { id: b.id, excerpt: text.length > 120 ? text.slice(0, 120).trimEnd() + "…" : text }
    })
    .filter((b) => b.excerpt)
}

async function accessibleRoom(supabase: SupabaseClient, roomId: string, userId: string | null) {
  const { data: room } = await supabase.from("debate_rooms").select(ROOM_ACCESS_COLS).eq("id", roomId).maybeSingle()
  if (!room || !(await canAccessRoom(supabase, room as RoomAccess, userId))) throw new Error("Not authorized")
  return room as RoomAccess & { content_object_id: string; summary: string | null }
}

// PUBLIC: what a room needs beyond its messages: the paragraphs a response can
// be tied to, the pinned summary, and whether the caller may edit it.
export async function getRoomContext(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const userId = _auth?.user?.id ?? null
  const room = await accessibleRoom(supabaseAdmin, (args?.data ?? {}).room_id, userId)
  return {
    summary: room.summary ?? null,
    canEditSummary: !!userId && room.created_by === userId,
    blocks: await freeBlocks(supabaseAdmin, room.content_object_id),
  }
}

// ROOM CREATOR: pin (or clear) the closing summary of a debate
export async function setRoomSummary(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const userId = _auth?.user?.id
  if (!userId) throw new Error("Unauthorized")
  const { room_id, summary } = (args?.data ?? {}) as { room_id: string; summary: string }
  const room = await accessibleRoom(supabaseAdmin, room_id, userId)
  if (room.created_by !== userId) throw new Error("Not authorized")
  const text = (summary ?? "").trim()
  if (text.length > 2000) throw new Error("Keep the summary under 2,000 characters")
  const { error } = await supabaseAdmin.from("debate_rooms").update({ summary: text || null }).eq("id", room_id)
  if (error) {
    console.error("[server]", error)
    throw new Error("Request failed. Please try again.")
  }
  return { summary: text || null }
}

// AUTHOR: search own followers/following to invite (handle/display_name match)
export async function searchInvitableUsers(args: { data?: any } = {}) {
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
    data: { query: string }
    context: ActionContext
  }) => {
    const me = context.userId!
    const [{ data: followers }, { data: following }] = await Promise.all([
      supabaseAdmin.from("follows").select("follower_id").eq("author_id", me),
      supabaseAdmin.from("follows").select("author_id").eq("follower_id", me),
    ])
    const ids = Array.from(
      new Set([
        ...(followers ?? []).map((r: { follower_id: string }) => r.follower_id),
        ...(following ?? []).map((r: { author_id: string }) => r.author_id),
      ])
    )
    if (!ids.length) return []
    let q = supabaseAdmin
      .from("profiles")
      .select("id, handle, display_name, avatar_url")
      .in("id", ids)
      .limit(20)
    if (data.query.trim().length > 0) {
      const term = `%${data.query.trim()}%`
      q = q.or(`handle.ilike.${term},display_name.ilike.${term}`)
    }
    const { data: profiles, error } = await q
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return profiles ?? []
  }
  return await __handler({
    data: args?.data as { query: string },
    context,
  })
}

// PUBLIC: graph for an author (pieces + branches + relationships)
export async function getAuthorGraph(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()

  const __handler = async ({ data }: { data: { author_id: string } }) => {
    const { data: pieces } = await supabaseAdmin
      .from("content_objects")
      .select("id, title, slug, status, visibility, reposted_from, published_at")
      .eq("author_id", data.author_id)
      .eq("status", "published")
      .eq("visibility", "public")
    const ids = (pieces ?? []).map((p: { id: string }) => p.id)
    if (ids.length === 0) return { pieces: [], branches: [], relationships: [] }
    const [{ data: branches }, { data: rels }] = await Promise.all([
      supabaseAdmin
        .from("branches")
        .select("id, parent_object_id, type, purpose, summary, created_at")
        .in("parent_object_id", ids)
        .eq("state", "published")
        .eq("visibility", "public"),
      supabaseAdmin
        .from("relationships")
        .select("id, from_object_id, to_object_id, type")
        .in("from_object_id", ids),
    ])
    const repostedIds = Array.from(
      new Set((pieces ?? []).map((p) => p.reposted_from).filter(Boolean))
    )
    let targetPieces: Record<string, unknown>[] = []
    if (repostedIds.length > 0) {
      const { data: targets } = await supabaseAdmin
        .from("content_objects")
        .select("id, title, slug, status, visibility, author_id, published_at")
        .in("id", repostedIds)
      
      let targetAuthors: Record<string, unknown>[] = []
      if (targets && targets.length > 0) {
        const targetAuthorIds = Array.from(new Set(targets.map(t => t.author_id).filter(Boolean)))
        if (targetAuthorIds.length > 0) {
          const { data: authors } = await supabaseAdmin
            .from("profiles")
            .select("id, handle, display_name")
            .in("id", targetAuthorIds)
          targetAuthors = authors ?? []
        }
      }
      
      const authorMap = new Map(targetAuthors.map(a => [a.id, a]))
      
      targetPieces = (targets ?? []).map(t => ({
        ...t,
        author: authorMap.get(t.author_id) ?? null
      }))
    }

    const syntheticRels = (pieces ?? [])
      .filter((p) => p.reposted_from)
      .map((p) => ({
        id: `synthetic-repost-${p.id}`,
        from_object_id: p.id,
        to_object_id: p.reposted_from,
        type: "repost",
      }))

    const allPieces = [...(pieces ?? [])]
    const existingIds = new Set(allPieces.map((p) => p.id))
    for (const tp of targetPieces) {
      if (!existingIds.has(tp.id)) {
        allPieces.push(tp as typeof allPieces[number])
      }
    }

    return {
      pieces: allPieces,
      branches: (branches ?? []).map((b: { id: string, parent_object_id: string, type: string, purpose: string | null, summary: string | null, created_at: string | null }) => ({
        id: b.id,
        parent_object_id: b.parent_object_id,
        branch_type: b.type,
        purpose: b.purpose,
        summary: b.summary,
        created_at: b.created_at,
      })),
      relationships: [...(rels ?? []), ...syntheticRels],
    }
  }
  return await __handler({ data: args?.data as { author_id: string } })
}

export async function getMyAuthorGraph() {
  const { data: _auth } = await (await createClient()).auth.getUser()
  if (!_auth?.user?.id) {
    throw new Error("Unauthorized")
  }
  return getAuthorGraph({ data: { author_id: _auth.user.id } })
}
