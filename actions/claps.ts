/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { getViewablePiece } from "@/actions/content/helpers"
import { checkRateLimit } from "@/lib/rate-limit.server"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getPieceClapStats(args: { data?: any } = {}) {
  const pieceId = String(args?.data?.piece_id ?? "")
  if (!UUID.test(pieceId)) return { total: 0, supporters: 0 }
  const db = await createAdminClient()
  // Summed in the database (piece_clap_stats), not by fetching every clap row.
  const { data } = await db.rpc("piece_clap_stats", { p_piece: pieceId }).maybeSingle<{ total: number; supporters: number }>()
  return { total: Number(data?.total ?? 0), supporters: Number(data?.supporters ?? 0) }
}

export async function getMyClaps(args: { data?: any } = {}) {
  const pieceId = String(args?.data?.piece_id ?? "")
  const { data: auth } = await (await createClient()).auth.getUser()
  if (!auth.user || !UUID.test(pieceId)) return { count: 0 }
  const db = await createAdminClient()
  const { data: row } = await db
    .from("piece_claps")
    .select("count")
    .eq("piece_id", pieceId)
    .eq("user_id", auth.user.id)
    .maybeSingle()
  return { count: row?.count ?? 0 }
}

// Sets the reader's clap total for a piece (0 removes it). The client sends the
// total, so repeats are idempotent; the server clamps it and checks who may clap.
export async function setMyClaps(args: { data?: any } = {}) {
  const pieceId = String(args?.data?.piece_id ?? "")
  const { data: auth } = await (await createClient()).auth.getUser()
  const userId = auth.user?.id
  if (!userId) throw new Error("Sign in to clap.")
  if (!UUID.test(pieceId)) throw new Error("Couldn't save claps.")
  const db = await createAdminClient()

  const piece = await getViewablePiece(db, pieceId, userId)
  if (!piece || piece.status !== "published") throw new Error("This piece can't be clapped.")
  // Claps feed the leaderboard; authors can't applaud themselves.
  if (piece.author_id === userId) throw new Error("You can't clap for your own piece.")

  const rl = await checkRateLimit("claps", userId, 120, 60)
  if (!rl.ok) throw new Error("Slow down a little, then try again.")

  const count = Math.max(0, Math.min(50, Math.floor(Number(args?.data?.count) || 0)))
  if (count === 0) {
    await db.from("piece_claps").delete().eq("piece_id", pieceId).eq("user_id", userId)
    return { ok: true, count: 0 }
  }
  const { error } = await db
    .from("piece_claps")
    .upsert({ piece_id: pieceId, user_id: userId, count }, { onConflict: "piece_id,user_id" })
  if (error) {
    console.error("[claps]", error)
    throw new Error("Couldn't save claps.")
  }
  // "Clap 5 pieces today" counts distinct pieces clapped today, re-claps included.
  const { checkClapThreshold } = await import("@/lib/quests.server")
  await checkClapThreshold(userId)
  return { ok: true, count }
}

// Public pieces a reader clapped, newest clap first, for their profile. Empty when
// they turned off "Show pieces I clapped" in Settings > Privacy.
export async function listClappedPieces(userId: string) {
  if (!UUID.test(userId)) return []
  const db = await createAdminClient()
  const { data: p } = await db.from("profiles").select("show_claps").eq("id", userId).maybeSingle()
  if (!p?.show_claps) return []
  const { data } = await db
    .from("piece_claps")
    .select(
      "count, piece:content_objects!inner(id, title, slug, summary, tags, cover_image_url, published_at, status, visibility, author:profiles!author_id(handle, display_name, avatar_url))"
    )
    .eq("user_id", userId)
    .eq("piece.status", "published")
    .eq("piece.visibility", "public")
    .order("updated_at", { ascending: false })
    .limit(100)
  return (data ?? []).map((r: any) => ({ ...r.piece, claps: r.count }))
}
