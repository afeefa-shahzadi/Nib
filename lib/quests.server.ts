// Internal quest helpers — called from other *.functions.ts handlers.
// Never imported on the client (filename ends in .server.ts).
//
// These take an already-verified userId and do no auth, so they use the TRUE
// service-role client. insight_points/daily_quests have no INSERT policy for
// `authenticated` (writes are system-only).
import { createServiceRoleClient } from "@/lib/supabase/server"
import { utcDayStart } from "@/lib/streak"

// Insight Points are non-cashable status points (rank, level, perks).
export const QUEST_POINTS = {
  // Reader quests — max 25 IP/day
  read_3: 8,
  annotate_1: 10,
  clap_5: 4,
  follow_1: 3,
  // Author quests — max 33 IP/day
  publish_1: 20,
  reply_1: 8,
} as const

export type QuestKey = keyof typeof QUEST_POINTS

export const READER_QUESTS: QuestKey[] = [
  "read_3",
  "annotate_1",
  "clap_5",
  "follow_1",
]
export const AUTHOR_QUESTS: QuestKey[] = ["publish_1", "reply_1"]

const startOfTodayISO = () => utcDayStart()

/** Idempotently award one quest for today (UTC). Safe to call from any handler. */
export async function tickQuest(userId: string, key: QuestKey) {
  try {
    const supabase = await createServiceRoleClient()
    const points = QUEST_POINTS[key]
    // One atomic RPC: unique (user, quest, UTC day) insert + IP row only if it won.
    const { data, error } = await supabase.rpc("tick_quest", {
      p_user: userId,
      p_key: key,
      p_points: points,
    })
    if (error) throw error
    return data ? { already: false, points } : { already: true, points: 0 }
  } catch (e) {
    console.error("[tickQuest]", key, e)
    return { already: false, points: 0 }
  }
}

/** Returns the per-quest progress counts for today (for UI display). */
export async function getQuestProgress(userId: string) {
  const supabase = await createServiceRoleClient()
  const today = startOfTodayISO()
  const [reads, claps, follows, annots, publishes, todaysAnnotations] =
    await Promise.all([
      supabase
        .from("telemetry_events")
        .select("piece_id")
        .eq("viewer_id", userId)
        .eq("event", "view")
        .gte("created_at", today),
      supabase
        .from("piece_claps")
        .select("piece_id")
        .eq("user_id", userId)
        .gte("updated_at", today),
      supabase
        .from("follows")
        .select("id")
        .eq("follower_id", userId)
        .gte("created_at", today),
      supabase
        .from("block_annotations")
        .select("id")
        .eq("user_id", userId)
        .gte("created_at", today),
      supabase
        .from("content_objects")
        .select("id")
        .eq("author_id", userId)
        .eq("status", "published")
        .gte("published_at", today),
      supabase
        .from("block_annotations")
        .select("content_object_id")
        .eq("user_id", userId)
        .gte("created_at", today),
    ])
  const distinctReads = new Set((reads.data ?? []).map((r) => r.piece_id)).size
  const distinctClaps = new Set((claps.data ?? []).map((r) => r.piece_id)).size
  // reply_1: annotations the user made today on their own pieces
  const annotPieceIds = Array.from(
    new Set((todaysAnnotations.data ?? []).map((r) => r.content_object_id))
  )
  let replyOwn = 0
  if (annotPieceIds.length) {
    const { data: ownPieces } = await supabase
      .from("content_objects")
      .select("id")
      .eq("author_id", userId)
      .in("id", annotPieceIds)
    const ownSet = new Set((ownPieces ?? []).map((p) => p.id))
    replyOwn = (todaysAnnotations.data ?? []).filter((r) =>
      ownSet.has(r.content_object_id)
    ).length
  }
  return {
    read_3: { current: Math.min(distinctReads, 3), target: 3 },
    annotate_1: { current: Math.min((annots.data ?? []).length, 1), target: 1 },
    clap_5: { current: Math.min(distinctClaps, 5), target: 5 },
    follow_1: { current: Math.min((follows.data ?? []).length, 1), target: 1 },
    publish_1: {
      current: Math.min((publishes.data ?? []).length, 1),
      target: 1,
    },
    reply_1: { current: Math.min(replyOwn, 1), target: 1 },
  }
}

/** Check threshold quests and tick if reached. Cheap; call inline from handlers. */
export async function checkClapThreshold(userId: string) {
  const supabase = await createServiceRoleClient()
  const today = startOfTodayISO()
  const { data } = await supabase
    .from("piece_claps")
    .select("piece_id")
    .eq("user_id", userId)
    .gte("updated_at", today)
  const distinct = new Set((data ?? []).map((r) => r.piece_id)).size
  if (distinct >= 5) await tickQuest(userId, "clap_5")
}

/**
 * Bump a lifetime user_stats counter. These feed the "Avid Reader" (pieces_read)
 * and "Valued Creator" (tips_received) quest ladders, which had no writer before.
 */
export async function bumpUserStat(
  userId: string,
  stat: "pieces_read" | "tips_received",
  delta = 1
) {
  // Atomic upsert + increment in SQL (migration 20261029040000).
  const supabase = await createServiceRoleClient()
  const { error } = await supabase.rpc("bump_user_stat", { p_user_id: userId, p_stat: stat, p_delta: delta })
  if (error) console.error("[server] bump_user_stat failed:", error)
}

export async function checkReadThreshold(viewerId: string) {
  const supabase = await createServiceRoleClient()
  const today = startOfTodayISO()
  const { data } = await supabase
    .from("telemetry_events")
    .select("piece_id")
    .eq("viewer_id", viewerId)
    .eq("event", "view")
    .gte("created_at", today)
  const distinct = new Set((data ?? []).map((r) => r.piece_id)).size
  if (distinct >= 3) await tickQuest(viewerId, "read_3")
}
