"use server"

import { createAdminClient, createClient } from "@/lib/supabase/server"

export async function getAnalyticsOverview() {
  const supabase = await createAdminClient()
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  if (!user) throw new Error("Unauthorized")

  // First get all pieces authored by this user
  const { data: pieces } = await supabase
    .from("content_objects")
    .select("id")
    .eq("author_id", user.id)

  if (!pieces || pieces.length === 0) {
    return { views: 0, modes: [], topPieces: [] }
  }

  const pieceIds = pieces.map((p) => p.id)

  // Get view counts
  const { count: viewCount } = await supabase
    .from("telemetry_events")
    .select("*", { count: "exact", head: true })
    .in("piece_id", pieceIds)
    .eq("event", "view")

  // Mode preferences (aggregate locally for now, since Supabase JS doesn't support GROUP BY directly without RPC)
  const { data: modeEvents } = await supabase
    .from("telemetry_events")
    .select("mode")
    .in("piece_id", pieceIds)
    .eq("event", "mode_change")
    .not("mode", "is", null)

  const modeCounts: Record<string, number> = {}
  if (modeEvents) {
    for (const e of modeEvents) {
      modeCounts[e.mode] = (modeCounts[e.mode] || 0) + 1
    }
  }

  const modes = Object.entries(modeCounts).map(([name, value]) => ({
    name,
    value,
  }))

  // Top pieces (by telemetry view count)
  // Since we can't GROUP BY easily, let's just get the top 5 pieces
  const { data: rawViews } = await supabase
    .from("telemetry_events")
    .select("piece_id")
    .in("piece_id", pieceIds)
    .eq("event", "view")

  const pieceViewCounts: Record<string, number> = {}
  if (rawViews) {
    for (const r of rawViews) {
      pieceViewCounts[r.piece_id] = (pieceViewCounts[r.piece_id] || 0) + 1
    }
  }

  const topPieceIds = Object.entries(pieceViewCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  let topPieces: Array<{ id: string; title: string; views: number }> = []
  if (topPieceIds.length > 0) {
    const { data: topPiecesData } = await supabase
      .from("content_objects")
      .select("id, title")
      .in(
        "id",
        topPieceIds.map((p) => p[0])
      )

    if (topPiecesData) {
      topPieces = topPieceIds.map((tp) => {
        const p = topPiecesData.find((x) => x.id === tp[0])
        return {
          id: tp[0],
          title: p?.title || "Unknown",
          views: tp[1],
        }
      })
    }
  }

  return {
    views: viewCount || 0,
    modes,
    topPieces,
  }
}
