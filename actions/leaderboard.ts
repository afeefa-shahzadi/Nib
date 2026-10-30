/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient } from "@/lib/supabase/server"
import { SupabaseClient } from "@supabase/supabase-js"
import { utcMonthStart } from "@/lib/streak"

type ProfileLite = {
  id: string
  handle: string | null
  display_name: string
  avatar_url: string | null
}

async function loadProfiles(
  supabaseAdmin: SupabaseClient,
  ids: string[]
): Promise<Map<string, ProfileLite>> {
  if (ids.length === 0) return new Map()
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, handle, display_name, avatar_url")
    .in("id", ids)
  return new Map(
    (data ?? []).map(
      (p: {
        id: string
        handle: string | null
        display_name: string
        avatar_url: string | null
      }) => [p.id, p as ProfileLite]
    )
  )
}

export type Timeframe = "week" | "month" | "all"

function rangeStart(timeframe: Timeframe): string | null {
  if (timeframe === "week") return new Date(Date.now() - 7 * 86_400_000).toISOString()
  if (timeframe === "month") return utcMonthStart()
  return null
}

// ============ READER LEADERBOARD ============
export async function readerLeaderboard(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()

  const __handler = async ({
    data,
  }: {
    data: { timeframe: Timeframe }
  }) => {
    const start = rangeStart(data.timeframe)

    // Points
    let ptsQ = supabaseAdmin.from("insight_points").select("user_id, points")
    if (start) ptsQ = ptsQ.gte("created_at", start)
    const { data: pts } = await ptsQ
    const points = new Map<string, number>()
    for (const r of pts ?? [])
      points.set(r.user_id, (points.get(r.user_id) ?? 0) + r.points)

    // Claps given (sum of count)
    let clQ = supabaseAdmin.from("piece_claps").select("user_id, count")
    if (start) clQ = clQ.gte("updated_at", start)
    const { data: cl } = await clQ
    const claps = new Map<string, number>()
    for (const r of cl ?? [])
      claps.set(r.user_id, (claps.get(r.user_id) ?? 0) + r.count)

    // Annotations
    let anQ = supabaseAdmin.from("block_annotations").select("user_id")
    if (start) anQ = anQ.gte("created_at", start)
    const { data: an } = await anQ
    const ann = new Map<string, number>()
    for (const r of an ?? []) ann.set(r.user_id, (ann.get(r.user_id) ?? 0) + 1)

    // Follows
    const { data: fo } = await supabaseAdmin
      .from("follows")
      .select("follower_id")
    const follows = new Map<string, number>()
    for (const r of fo ?? [])
      follows.set(r.follower_id, (follows.get(r.follower_id) ?? 0) + 1)

    // Streaks (canonical table is user_stats — reading_streaks is legacy/unwritten)
    const { data: st } = await supabaseAdmin
      .from("user_stats")
      .select("user_id, current_streak, longest_streak")
    const streak = new Map<string, { current: number; longest: number }>()
    for (const r of st ?? [])
      streak.set(r.user_id, {
        current: r.current_streak ?? 0,
        longest: r.longest_streak ?? 0,
      })

    // Real money a reader earns: the curator share on sales from their collections.
    // Insight points are recognition only and never convert to cash.
    let cuQ = supabaseAdmin.from("earnings_ledger").select("user_id, net_paise").eq("source", "curator_share")
    if (start) cuQ = cuQ.gte("created_at", start)
    const { data: cu } = await cuQ
    const curated = new Map<string, number>()
    for (const r of cu ?? []) curated.set(r.user_id, (curated.get(r.user_id) ?? 0) + r.net_paise)

    // Union user ids; only keep users with any activity in window
    const ids = new Set<string>([
      ...curated.keys(),
      ...points.keys(),
      ...claps.keys(),
      ...ann.keys(),
    ])
    if (data.timeframe === "all") {
      for (const k of follows.keys()) ids.add(k)
      for (const k of streak.keys()) ids.add(k)
    }
    const profiles = await loadProfiles(supabaseAdmin, [...ids])

    const rows = [...ids].map((id) => {
      const p = profiles.get(id)
      const pt = points.get(id) ?? 0
      const s = streak.get(id)
      return {
        userId: id,
        handle: p?.handle ?? null,
        displayName: p?.display_name ?? "Anonymous",
        avatarUrl: p?.avatar_url ?? null,
        points: pt,
        tier: getReaderTier(pt),
        earningsPaise: curated.get(id) ?? 0,
        claps: claps.get(id) ?? 0,
        annotations: ann.get(id) ?? 0,
        follows: follows.get(id) ?? 0,
        currentStreak: s?.current ?? 0,
        longestStreak: s?.longest ?? 0,
        activityScore:
          (points.get(id) ?? 0) +
          (claps.get(id) ?? 0) +
          (ann.get(id) ?? 0) * 3 +
          (follows.get(id) ?? 0) * 2,
      }
    })
    rows.sort((a, b) => b.activityScore - a.activityScore)
    rows.forEach((r, i) => ((r as { rank?: number }).rank = i + 1))
    return {
      rows: rows.slice(0, 500),
      total: rows.length,
      timeframe: data.timeframe,
    }
  }
  return await __handler({ data: args?.data as { timeframe: Timeframe } })
}

function getReaderTier(points: number) {
  if (points >= 1000) return "Diamond"
  if (points >= 500) return "Platinum"
  if (points >= 250) return "Gold"
  if (points >= 100) return "Silver"
  return "Bronze"
}

// ============ AUTHOR LEADERBOARD ============
export async function authorLeaderboard(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()

  const __handler = async ({
    data,
  }: {
    data: { timeframe: Timeframe }
  }) => {
    const start = rangeStart(data.timeframe)

    // Followers
    const { data: fo } = await supabaseAdmin.from("follows").select("author_id")
    const followers = new Map<string, number>()
    for (const r of fo ?? [])
      followers.set(r.author_id, (followers.get(r.author_id) ?? 0) + 1)

    // Published pieces & piece->author map
    let pcQ = supabaseAdmin
      .from("content_objects")
      .select("id, author_id, published_at")
      .eq("status", "published")
      .eq("visibility", "public")
    if (start) pcQ = pcQ.gte("published_at", start)
    const { data: pieces } = await pcQ
    const published = new Map<string, number>()
    const pieceAuthor = new Map<string, string>()
    for (const r of pieces ?? []) {
      published.set(r.author_id, (published.get(r.author_id) ?? 0) + 1)
      pieceAuthor.set(r.id, r.author_id)
    }

    // Claps received — need full piece->author map
    if (start) {
      const { data: allPieces } = await supabaseAdmin
        .from("content_objects")
        .select("id, author_id")
      for (const r of allPieces ?? []) pieceAuthor.set(r.id, r.author_id)
    }
    let clQ = supabaseAdmin.from("piece_claps").select("piece_id, count")
    if (start) clQ = clQ.gte("updated_at", start)
    const { data: cl } = await clQ
    const claps = new Map<string, number>()
    for (const r of cl ?? []) {
      const a = pieceAuthor.get(r.piece_id)
      if (a) claps.set(a, (claps.get(a) ?? 0) + r.count)
    }

    // Tips received
    let tipQ = supabaseAdmin
      .from("tips")
      .select("author_id, net_paise")
      .eq("status", "paid")
    if (start) tipQ = tipQ.gte("created_at", start)
    const { data: tips } = await tipQ
    const tipsIn = new Map<string, number>()
    for (const r of tips ?? [])
      tipsIn.set(r.author_id, (tipsIn.get(r.author_id) ?? 0) + (r.net_paise || 0))

    // Earnings ledger
    let edQ = supabaseAdmin.from("earnings_ledger").select("user_id, net_paise")
    if (start) edQ = edQ.gte("created_at", start)
    const { data: ed } = await edQ
    const ledger = new Map<string, number>()
    for (const r of ed ?? [])
      ledger.set(r.user_id, (ledger.get(r.user_id) ?? 0) + r.net_paise)

    const ids = new Set<string>([
      ...followers.keys(),
      ...published.keys(),
      ...claps.keys(),
      ...tipsIn.keys(),
      ...ledger.keys(),
    ])
    const profiles = await loadProfiles(supabaseAdmin, [...ids])

    const rows = [...ids].map((id) => {
      const p = profiles.get(id)
      const earnings = (ledger.get(id) ?? 0) + (tipsIn.get(id) ?? 0)
      return {
        userId: id,
        handle: p?.handle ?? null,
        displayName: p?.display_name ?? "Anonymous",
        avatarUrl: p?.avatar_url ?? null,
        followers: followers.get(id) ?? 0,
        published: published.get(id) ?? 0,
        claps: claps.get(id) ?? 0,
        tipsPaise: tipsIn.get(id) ?? 0,
        earningsPaise: earnings,
        popularityScore: (followers.get(id) ?? 0) * 5 + (claps.get(id) ?? 0),
        activenessScore: (published.get(id) ?? 0) * 10 + (claps.get(id) ?? 0),
      }
    })
    rows.sort((a, b) => b.popularityScore - a.popularityScore)
    rows.forEach((r, i) => ((r as { rank?: number }).rank = i + 1))
    return {
      rows: rows.slice(0, 500),
      total: rows.length,
      timeframe: data.timeframe,
    }
  }
  return await __handler({ data: args?.data as { timeframe: Timeframe } })
}

// Rank lookup for the signed-in user
export async function myLeaderboardRank(args: { data?: any } = {}) {

  const __handler = async ({ data }: { data: { userId: string } }) => {
    const [r, a] = await Promise.all([
      readerLeaderboard({ data: { timeframe: "all" } }),
      authorLeaderboard({ data: { timeframe: "all" } }),
    ])
    const readerRow = r.rows.find((x) => x.userId === data.userId)
    const authorRow = a.rows.find((x) => x.userId === data.userId)
    return {
      reader: readerRow
        ? {
            rank: (readerRow as { rank?: number }).rank ?? null,
            total: r.total,
            points: readerRow.points,
          }
        : null,
      author: authorRow
        ? {
            rank: (authorRow as { rank?: number }).rank ?? null,
            total: a.total,
            followers: authorRow.followers,
            earningsPaise: authorRow.earningsPaise,
          }
        : null,
    }
  }
  return await __handler({ data: args?.data as { userId: string } })
}
