/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"
import { hasStudioAccess } from "@/lib/plan"
import { CO_COLS } from "../../helpers"

// ---------- CREATOR: list own pieces ----------
export async function listMyPieces() {
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabase,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    const { data, error } = await context.supabase
      .from("content_objects")
      .select("id, title, slug, status, visibility, updated_at, published_at, scheduled_for")
      .eq("author_id", context.userId!)
      .order("updated_at", { ascending: false })
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return data ?? []
  }
  return await __handler({ context })
}

// ---------- CREATOR: one page of own pieces for the Pieces screen ----------
const PIECE_STATUSES = ["draft", "scheduled", "published", "archived", "deleted"] as const
const PIECE_SORTS = {
  edited: { column: "updated_at", ascending: false },
  published: { column: "published_at", ascending: false },
  title: { column: "title", ascending: true },
} as const

export async function pageMyPieces(args: {
  tab?: string
  visibility?: string
  sort?: string
  search?: string
  page?: number
  perPage?: number
} = {}) {
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()
  const userId = _auth?.user?.id
  if (!userId) throw new Error("Sign in first.")

  const perPage = Math.min(Math.max(args.perPage ?? 20, 1), 100)
  const page = Math.max(args.page ?? 0, 0)
  const tab = (PIECE_STATUSES as readonly string[]).includes(args.tab ?? "") ? args.tab! : "all"
  const sort = PIECE_SORTS[(args.sort ?? "edited") as keyof typeof PIECE_SORTS] ?? PIECE_SORTS.edited
  const term = (args.search ?? "").trim().slice(0, 100).replace(/[%_\\]/g, (c) => "\\" + c)

  let q = supabase
    .from("content_objects")
    .select("id, title, slug, status, visibility, updated_at, published_at, scheduled_for", { count: "exact" })
    .eq("author_id", userId)
  q = tab === "all" ? q.neq("status", "deleted") : q.eq("status", tab)
  if (args.visibility && args.visibility !== "any") q = q.eq("visibility", args.visibility)
  if (term) q = q.ilike("title", `%${term}%`)
  q = q
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order("id")
    .range(page * perPage, page * perPage + perPage - 1)

  const countFor = (status: string) =>
    supabase.from("content_objects").select("id", { count: "exact", head: true }).eq("author_id", userId).eq("status", status)

  const [{ data, count, error }, ...counts] = await Promise.all([q, ...PIECE_STATUSES.map(countFor)])
  if (error) {
    console.error("[server]", error)
    throw new Error("Request failed. Please try again.")
  }
  const byStatus = Object.fromEntries(PIECE_STATUSES.map((s, i) => [s, counts[i].count ?? 0])) as Record<string, number>
  byStatus.all = PIECE_STATUSES.filter((s) => s !== "deleted").reduce((n, s) => n + byStatus[s], 0)
  return { rows: data ?? [], total: count ?? 0, counts: byStatus }
}

// ---------- CREATOR: get own piece w/ blocks ----------
export async function getMyPiece(args: { data?: any } = {}) {
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabase,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { id: string }
    context: ActionContext
  }) => {
    const { data: piece, error } = await context.supabase
      .from("content_objects")
      .select(CO_COLS)
      .eq("id", data.id)
      .maybeSingle()
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    if (!piece) return null
    const { data: blocks } = await context.supabase
      .from("blocks")
      .select("*")
      .eq("content_object_id", piece.id)
      .order("order", { ascending: true })
    const { data: branches } = await context.supabase
      .from("branches")
      .select("*")
      .eq("parent_object_id", piece.id)
      .order("created_at", { ascending: false })
    let originalPiece = null
    let originalAuthor = null
    let originalBlocks = []

    if (piece.reposted_from) {
      const { data: op } = await context.supabase
        .from("content_objects")
        .select(CO_COLS)
        .eq("id", piece.reposted_from)
        .maybeSingle()

      if (op) {
        originalPiece = op
        const [{ data: oa }, { data: ob }] = await Promise.all([
          context.supabase
            .from("profiles")
            .select("id, handle, display_name, avatar_url, bio")
            .eq("id", op.author_id)
            .maybeSingle(),
          context.supabase
            .from("blocks")
            .select("*")
            .eq("content_object_id", op.id)
            .order("order", { ascending: true }),
        ])
        originalAuthor = oa
        originalBlocks = ob ?? []
      }
    }

    return {
      piece,
      blocks: blocks ?? [],
      branches: branches ?? [],
      originalPiece,
      originalAuthor,
      originalBlocks,
    }
  }
  return await __handler({ data: args?.data as { id: string }, context })
}

// ---------- CREATOR: dashboard stats ----------
export async function getStudioStats(args: { data?: any } = {}) {
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabase,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { days?: number; org_id?: string | null }
    context: ActionContext
  }) => {
    const { data: profile } = await context.supabase.from("profiles").select("plan").eq("id", context.userId).single()
    if (!hasStudioAccess(profile?.plan)) {
      return null
    }

    const days = data.days ?? 30
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()
    const sincePrev = new Date(
      Date.now() - 2 * days * 24 * 3600 * 1000
    ).toISOString()

    // Branches have no owner column of their own — ownership routes through
    // the parent piece, the same way listMyBranches resolves it.
    const { data: myPieceIds } = await context.supabase
      .from("content_objects")
      .select("id")
      .eq("author_id", context.userId!)
    const pieceIds = (myPieceIds ?? []).map((p: { id: string }) => p.id)

    const [
      { count: drafts },
      { count: published },
      { count: branches },
      { count: bundles },
      { count: supporters },
      { data: revenueRows },
      { count: debateRooms },
      { count: scheduled },
    ] = await Promise.all([
      context.supabase
        .from("content_objects")
        .select("*", { count: "exact", head: true })
        .eq("status", "draft")
        .or(
          data.org_id
            ? `org_id.eq.${data.org_id}`
            : `author_id.eq.${context.userId!}`
        ),
      context.supabase
        .from("content_objects")
        .select("*", { count: "exact", head: true })
        .eq("status", "published")
        .or(
          data.org_id
            ? `org_id.eq.${data.org_id}`
            : `author_id.eq.${context.userId!}`
        ),
      pieceIds.length
        ? context.supabase
            .from("branches")
            .select("*", { count: "exact", head: true })
            .in("parent_object_id", pieceIds)
        : Promise.resolve({ count: 0 }),
      context.supabase
        .from("bundles")
        .select("*", { count: "exact", head: true })
        .eq("author_id", context.userId!),
      context.supabase
        .from("memberships")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .eq("author_id", context.userId),
      context.supabase
        .from("purchases")
        .select("amount_paise, created_at")
        .eq("status", "paid")
        .eq("author_id", context.userId)
        .gte("created_at", sincePrev),
      context.supabase
        .from("debate_rooms")
        .select("*", { count: "exact", head: true })
        .eq("created_by", context.userId),
      // Scheduled: unpublished pieces with a release date.
      context.supabase
        .from("content_objects")
        .select("*", { count: "exact", head: true })
        .eq("status", "scheduled")
        .or(
          data.org_id
            ? `org_id.eq.${data.org_id}`
            : `author_id.eq.${context.userId!}`
        )
    ])

    let currentRevenue = 0
    let prevRevenue = 0

    for (const r of revenueRows ?? []) {
      if (r.created_at >= since) {
        currentRevenue += r.amount_paise || 0
      } else {
        prevRevenue += r.amount_paise || 0
      }
    }

    const revenueDelta = prevRevenue
      ? Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100)
      : 0

    return {
      drafts: drafts ?? 0,
      scheduled: scheduled ?? 0,
      published: published ?? 0,
      branches: branches ?? 0,
      bundles: bundles ?? 0,
      supporters: supporters ?? 0,
      debateRooms: debateRooms ?? 0,
      revenue30dPaise: currentRevenue,
      revenueDelta,
    }
  }
  return await __handler({
    data: (args?.data ?? {}) as { days?: number; org_id?: string },
    context,
  })
}

// ---------- CREATOR: recent activity ----------
export async function getRecentActivity(args: { data?: any } = {}) {
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabase,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { org_id?: string | null }
    context: ActionContext
  }) => {
    let piecesQuery = context.supabase
      .from("content_objects")
      .select("id, title, status, updated_at, published_at")
      .neq("status", "deleted")

    if (data.org_id) {
      piecesQuery = piecesQuery.eq("org_id", data.org_id)
    } else {
      piecesQuery = piecesQuery.eq("author_id", context.userId!)
    }

    const [{ data: pieces }, { data: subs }, { data: purchases }] =
      await Promise.all([
        piecesQuery.order("updated_at", { ascending: false }).limit(8),
        context.supabase
          .from("memberships")
          .select("id, user_id, started_at, tier_id")
          .eq("author_id", context.userId)
          .order("started_at", { ascending: false })
          .limit(8),
        context.supabase
          .from("purchases")
          .select("id, user_id, amount_paise, kind, created_at, status")
          .eq("author_id", context.userId)
          .eq("status", "paid")
          .order("created_at", { ascending: false })
          .limit(8),
      ])
    return {
      pieces: pieces ?? [],
      subs: subs ?? [],
      purchases: purchases ?? [],
    }
  }
  return await __handler({
    data: (args?.data ?? {}) as { org_id?: string | null },
    context,
  })
}

// ---------- ARCHIVE RETRIEVAL ----------
export async function searchMyArchive(args: { data?: any } = {}) {
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabase,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { limit?: number; exclude_piece_id?: string; q: string }
    context: ActionContext
  }) => {
    const limit = data.limit ?? 8
    const { data: pieces, error: pErr } = await context.supabase
      .from("content_objects")
      .select("id, title, slug, status, updated_at")
      .eq("author_id", context.userId!)
      .in("status", ["draft", "published"])
      .order("updated_at", { ascending: false })
      .limit(80)
    if (pErr) {
      console.error("[server]", pErr)
      throw new Error("Request failed. Please try again.")
    }
    const pool = (pieces ?? []).filter((p) => p.id !== data.exclude_piece_id)
    if (pool.length === 0) return []

    // Archive is always the current user's own work, so the link handle is
    // their own. Without it the citation URL fell back to `/u/_/slug` → 404.
    const { data: me } = await context.supabase
      .from("profiles")
      .select("handle")
      .eq("id", context.userId!)
      .maybeSingle()
    const handle = me?.handle ?? null

    if (!data.q.trim()) {
      return pool.slice(0, limit).map((p) => ({
        block_id: p.id,
        piece_id: p.id,
        piece_title: p.title || "Untitled",
        piece_slug: p.slug,
        piece_status: p.status as string,
        handle,
        type: "piece",
        snippet: p.status === "published" ? "Published piece" : "Draft piece",
        text: "",
        semantic_role: null,
      }))
    }

    const pieceMap = new Map(pool.map((p) => [p.id, p]))
    const { data: blocks, error: bErr } = await context.supabase
      .from("blocks")
      .select("id, content_object_id, type, content, order, semantic_role")
      .in(
        "content_object_id",
        pool.map((p) => p.id)
      )
      .order("order", { ascending: true })
    if (bErr) {
      console.error("[server]", bErr)
      throw new Error("Request failed. Please try again.")
    }
    const needle = data.q.toLowerCase()
    type Hit = {
      block_id: string
      piece_id: string
      piece_title: string
      piece_slug: string
      piece_status: string
      handle: string | null
      type: string
      snippet: string
      text: string
      semantic_role: string | null
    }
    const hits: Hit[] = []
    for (const b of blocks ?? []) {
      const c = (b.content ?? {}) as Record<string, unknown>
      const raw = [c.text, c.body, c.caption, c.quote, c.source, c.code]
        .filter((v) => typeof v === "string")
        .join(" ")
        .trim()
      if (!raw) continue
      const lower = raw.toLowerCase()
      const idx = lower.indexOf(needle)
      if (idx === -1) continue
      const start = Math.max(0, idx - 40)
      const end = Math.min(raw.length, idx + needle.length + 80)
      const snippet =
        (start > 0 ? "…" : "") +
        raw.slice(start, end) +
        (end < raw.length ? "…" : "")
      const piece = pieceMap.get(b.content_object_id)
      if (!piece) continue
      hits.push({
        block_id: b.id,
        piece_id: piece.id,
        piece_title: piece.title,
        piece_slug: piece.slug,
        piece_status: piece.status as string,
        handle,
        type: b.type as string,
        snippet,
        text: raw.slice(0, 600),
        semantic_role: (b.semantic_role as string | null) ?? null,
      })
      if (hits.length >= limit) break
    }
    return hits
  }
  return await __handler({
    data: args?.data as {
      limit?: number
      exclude_piece_id?: string
      q: string
    },
    context,
  })
}

// ---------- COAUTHORS ----------
export async function getCoAuthors(args: { data?: any } = {}) {
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase,
  }
  const __handler = async ({
    data,
    context,
  }: {
    data: { pieceId: string }
    context: ActionContext
  }) => {
    const { data: coauthors, error } = await context.supabase
      .from("piece_coauthors")
      .select("id, user_id, profile:profiles(handle, display_name, avatar_url)")
      .eq("piece_id", data.pieceId)
    if (error) throw new Error("Failed to load co-authors")
    return coauthors ?? []
  }
  return await __handler({ data: args.data as { pieceId: string }, context })
}
