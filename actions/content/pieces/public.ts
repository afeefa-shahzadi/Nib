/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient } from "@/lib/supabase/server"
import { excludeNsfw } from "@/lib/nsfw"
import { CO_COLS, tryGetViewerId, viewerHasAuthorAccess, isPieceViewable, gateBlocks } from "../helpers"

// ---------- PUBLIC: list latest published pieces ----------
export async function listPublishedPieces() {
  const supabaseAdmin = await createAdminClient()

  const __handler = async () => {
    const { data, error } = await excludeNsfw(
      supabaseAdmin
        .from("content_objects")
        .select("id, title, slug, summary, tags, published_at, author_id")
        .eq("status", "published")
        .eq("visibility", "public")
        .order("published_at", { ascending: false })
        .limit(24)
    )
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }

    const authorIds = Array.from(new Set((data ?? []).map((d) => d.author_id)))
    const { data: authors } = authorIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, handle, display_name")
          .in("id", authorIds)
      : { data: [] as { id: string; handle: string; display_name: string }[] }
    const authorMap = new Map((authors ?? []).map((a) => [a.id, a]))
    return (data ?? []).map((p) => ({
      ...p,
      author: authorMap.get(p.author_id) ?? null,
    }))
  }
  return await __handler()
}

// ---------- PUBLIC: read a piece by slug ----------
export async function getPieceBySlug(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()

  const __handler = async ({ data }: { data: { slug: string } }) => {
    const { data: piece, error: error } = await supabaseAdmin
      .from("content_objects")
      .select(CO_COLS)
      .eq("slug", data.slug)
      .eq("status", "published")
      .eq("visibility", "public")
      .maybeSingle()
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    if (!piece) {
      // A piece disabled by a copyright claim is archived. Show a transparency
      // surface ("removed following a copyright claim") instead of a 404, and —
      // for the author — a link to file a counter-notice. Only archived pieces
      // with an actioned DMCA notice qualify; other archived pieces fall through
      // to the normal owner/404 handling below. Read via service role: the
      // surface is public, but RLS would hide another user's archived piece.
      const svc = supabaseAdmin
      const { data: archived } = await svc
        .from("content_objects")
        .select("id, author_id, status")
        .eq("slug", data.slug)
        .eq("status", "archived")
        .maybeSingle()
      if (archived) {
        // A piece may have several actioned notices; take the most recent one
        // for the counter-notice link (limit(1) so maybeSingle never errors).
        const { data: notice } = await svc
          .from("dmca_notices")
          .select("id")
          .eq("target_content_object_id", archived.id)
          .eq("status", "actioned")
          .order("actioned_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (notice) {
          const viewerId = await tryGetViewerId()
          return {
            restricted: "dmca" as const,
            pieceId: archived.id as string,
            noticeId: notice.id as string,
            isOwner: viewerId === archived.author_id,
          }
        }
      }

      // The public query hides private/draft/scheduled pieces. For a stranger
      // that correctly looks like a 404 (don't reveal the piece exists). But if
      // the viewer owns this slug, tell them why it isn't public instead of a
      // confusing dead-end — they likely pasted their own draft URL.
      const viewerId = await tryGetViewerId()
      if (viewerId) {
        const { data: owned } = await supabaseAdmin
          .from("content_objects")
          .select("id, author_id, status, visibility")
          .eq("slug", data.slug)
          .eq("author_id", viewerId)
          .maybeSingle()
        if (owned) {
          return {
            restricted: "owner" as const,
            pieceId: owned.id,
            status: owned.status as string,
            visibility: owned.visibility as string,
          }
        }
      }
      return null
    }

    const [
      { data: blocks },
      { data: branches },
      { data: author },
      { data: siblings },
      { data: responses },
    ] = await Promise.all([
      supabaseAdmin
        .from("blocks")
        .select("*")
        .eq("content_object_id", piece.id)
        .then(({ data, error }) => {
          if (error) return { data, error }
          return {
            data: data?.sort(
              (a: Record<string, unknown>, b: Record<string, unknown>) => ((a.order as number) || 0) - ((b.order as number) || 0)
            ),
            error,
          }
        }),
      supabaseAdmin
        .from("branches")
        .select("*")
        .eq("parent_object_id", piece.id)
        .eq("state", "published")
        .eq("visibility", "public")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("profiles")
        .select("id, handle, display_name, bio, avatar_url")
        .eq("id", piece.author_id)
        .maybeSingle(),
      supabaseAdmin
        .from("content_objects")
        .select("title, slug, published_at")
        .eq("author_id", piece.author_id)
        .eq("status", "published")
        .eq("visibility", "public")
        .order("published_at", { ascending: false }),
      supabaseAdmin
        .from("piece_responses")
        .select("sources")
        .eq("piece_id", piece.id)
        .not("sources", "is", null),
    ])

    // Gating blocks
    const viewerId = await tryGetViewerId()
    const hasAccess = await viewerHasAuthorAccess(viewerId, piece.author_id, piece.id)
    const safeBlocks = gateBlocks(blocks ?? [], hasAccess)

    const list = siblings ?? []
    const idx = list.findIndex((s) => s.slug === piece.slug)
    const prev = idx >= 0 ? (list[idx + 1] ?? null) : null
    const next = idx > 0 ? (list[idx - 1] ?? null) : null
    let originalPiece = null
    let originalAuthor = null
    let originalBlocks = []

    if (piece.reposted_from) {
      const { data: op } = await supabaseAdmin
        .from("content_objects")
        .select(CO_COLS)
        .eq("id", piece.reposted_from)
        .maybeSingle()

      // The original may since have gone private, archived or draft: only
      // show it when this viewer could open it directly.
      if (op && (await isPieceViewable(op, viewerId))) {
        originalPiece = op
        const [{ data: oa }, { data: ob }] = await Promise.all([
          supabaseAdmin
            .from("profiles")
            .select("id, handle, display_name, avatar_url, bio")
            .eq("id", op.author_id)
            .maybeSingle(),
          supabaseAdmin
            .from("blocks")
            .select("*")
            .eq("content_object_id", op.id)
            .order("order", { ascending: true }),
        ])
        originalAuthor = oa
        originalBlocks = gateBlocks(
          ob ?? [],
          await viewerHasAuthorAccess(viewerId, op.author_id, op.id)
        )
      }
    }

    return {
      piece,
      blocks: safeBlocks,
      commentSources: (responses ?? []).flatMap((r: { sources?: import("@/lib/types/content").SourceCitation[] }) => r.sources || []),
      branches: branches ?? [],
      author,
      prev,
      next,
      viewerHasAccess: hasAccess,
      originalPiece,
      originalAuthor,
      originalBlocks,
    }
  }
  return await __handler({ data: args?.data as { slug: string } })
}

// ---------- PUBLIC: author profile + pieces by handle ----------
export async function getAuthorByHandle(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()

  const __handler = async ({ data }: { data: { handle: string } }) => {
    const { data: author, error } = await supabaseAdmin
      .from("profiles")
      .select("id, handle, display_name, bio, avatar_url, flair, created_at, website, links, pinned_piece_id, date_of_birth, show_birthday")
      .eq("handle", data.handle)
      .maybeSingle()
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    if (!author) return null
    // Birthday is opt-in and shows day and month only; the full date never leaves the server.
    const { date_of_birth, show_birthday, ...publicAuthor } = author as typeof author & { date_of_birth: string | null; show_birthday: boolean }
    const birthday =
      show_birthday && date_of_birth
        ? new Date(date_of_birth).toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "UTC" })
        : null
    const { data: pieces } = await excludeNsfw(
      supabaseAdmin
        .from("content_objects")
        .select("id, title, slug, summary, tags, published_at, cover_image_url")
        .eq("author_id", author.id)
        .eq("status", "published")
        .eq("visibility", "public")
        .order("published_at", { ascending: false })
    )
    const { data: tiers } = await supabaseAdmin
      .from("membership_tiers")
      .select("id, name, description, price_cents, perks")
      .eq("author_id", author.id)
      .order("price_cents", { ascending: true })
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabaseAdmin.from("follows").select("id", { count: "exact", head: true }).eq("author_id", author.id),
      supabaseAdmin.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", author.id),
    ])
    return {
      author: { ...publicAuthor, birthday },
      pieces: pieces ?? [],
      tiers: tiers ?? [],
      followers: followers ?? 0,
      following: following ?? 0,
    }
  }
  return await __handler({ data: args?.data as { handle: string } })
}

// ---------- PUBLIC: related pieces ----------
export async function getRelatedPieces(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()

  const __handler = async ({ data }: { data: { piece_id: string } }) => {
    const [{ data: out }, { data: inb }] = await Promise.all([
      supabaseAdmin
        .from("relationships")
        .select("type, to_object_id")
        .eq("from_object_id", data.piece_id),
      supabaseAdmin
        .from("relationships")
        .select("type, from_object_id")
        .eq("to_object_id", data.piece_id),
    ])
    const ids = new Set<string>()
    const typeById = new Map<string, string>()
    for (const r of out ?? []) {
      ids.add(r.to_object_id)
      typeById.set(r.to_object_id, r.type)
    }
    for (const r of inb ?? []) {
      ids.add(r.from_object_id)
      if (!typeById.has(r.from_object_id))
        typeById.set(r.from_object_id, r.type)
    }
    if (ids.size === 0) return []
    const { data: pieces } = await excludeNsfw(
      supabaseAdmin
        .from("content_objects")
        .select("id, title, slug, summary, author_id")
        .in("id", Array.from(ids))
        .eq("status", "published")
        .eq("visibility", "public")
        .limit(12)
    )
    const authorIds = Array.from(
      new Set((pieces ?? []).map((p) => p.author_id))
    )
    const { data: authors } = await supabaseAdmin
      .from("profiles")
      .select("id, handle")
      .in("id", authorIds)
    const handleById = new Map((authors ?? []).map((a) => [a.id, a.handle]))
    
    // Fetch claps
    const { data: claps } = await supabaseAdmin
      .from("piece_claps")
      .select("piece_id, count")
      .in("piece_id", Array.from(ids))
    const clapsById = new Map<string, number>()
    for (const c of claps ?? []) {
      const prev = clapsById.get(c.piece_id) ?? 0
      clapsById.set(c.piece_id, prev + (c.count ?? 0))
    }

    return (pieces ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      summary: p.summary,
      handle: handleById.get(p.author_id) ?? "_",
      type: typeById.get(p.id) ?? "related",
      claps: clapsById.get(p.id) ?? 0,
    }))
  }
  return await __handler({ data: args?.data as { piece_id: string } })
}
