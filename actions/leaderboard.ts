/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient } from "@/lib/supabase/server"
import { SupabaseClient } from "@supabase/supabase-js"
import { utcMonthStart } from "@/lib/streak"
import { unstable_cache } from "next/cache"

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
  // Chunked: 500 ids in one .in() filter makes a URL too long for the gateway.
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += 150) chunks.push(ids.slice(i, i + 150))
  const pages = await Promise.all(
    chunks.map((c) => supabaseAdmin.from("profiles").select("id, handle, display_name, avatar_url").in("id", c))
  )
  const data = pages.flatMap((r) => r.data ?? [])
  return new Map(
    data.map(
      (p: {
        id: string
        handle: string | null
        display_name: string
        avatar_url: string | null
      }) => [p.id, p as ProfileLite]
    )
  )
}

// Totals are summed in Postgres (see the leaderboard_*_totals functions); one jsonb value per board.
// Each run aggregates whole tables, so share one result per board and
// timeframe for 5 minutes: the cached pages and every viewer's
// myLeaderboardRank read the same copy instead of re-summing.
// ponytail: still a full aggregate every 5 min, and the data cache drops entries over 2MB (~15k
// active users); move to a cron-refreshed snapshot table that stores only the top 500 before then.
const totalsCached = unstable_cache(
  async (fn: string, timeframe: Timeframe): Promise<any[]> => {
    const supabaseAdmin = await createAdminClient()
    const { data, error } = await supabaseAdmin.rpc(fn, { p_start: rangeStart(timeframe) })
    if (error) throw new Error(error.message)
    return (data ?? []) as any[]
  },
  ["leaderboard-totals"],
  { revalidate: 300 }
)
const totals = (_db: SupabaseClient, fn: string, timeframe: Timeframe) => totalsCached(fn, timeframe)

// Names and avatars only for the rows that are shown.
async function withProfiles<T extends { userId: string }>(supabaseAdmin: SupabaseClient, rows: T[]): Promise<T[]> {
  const profiles = await loadProfiles(supabaseAdmin, rows.map((r) => r.userId))
  for (const r of rows as any[]) {
    const p = profiles.get(r.userId)
    if (p) Object.assign(r, { handle: p.handle, displayName: p.display_name, avatarUrl: p.avatar_url })
  }
  return rows
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

    // Readers who left the board in Settings > Privacy.
    const [t, { data: hidden }] = await Promise.all([
      totals(supabaseAdmin, "leaderboard_reader_totals", data.timeframe),
      supabaseAdmin.from("profiles").select("id").eq("hide_from_leaderboard", true),
    ])
    const out = new Set((hidden ?? []).map((h: { id: string }) => h.id))
    const rows = t.filter((x) => !out.has(x.id)).map((x) => {
      const pt = Number(x.points)
      return {
        userId: x.id as string,
        handle: null as string | null,
        displayName: "Anonymous",
        avatarUrl: null as string | null,
        points: pt,
        tier: getReaderTier(pt),
        earningsPaise: Number(x.earnings),
        claps: Number(x.claps),
        annotations: Number(x.annotations),
        follows: Number(x.follows),
        currentStreak: Number(x.current_streak),
        longestStreak: Number(x.longest_streak),
        activityScore: pt + Number(x.claps) + Number(x.annotations) * 3 + Number(x.follows) * 2,
      }
    })
    rows.sort((a, b) => b.activityScore - a.activityScore)
    rows.forEach((r, i) => ((r as { rank?: number }).rank = i + 1))
    return {
      rows: await withProfiles(supabaseAdmin, rows.slice(0, 500)),
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

    const t = await totals(supabaseAdmin, "leaderboard_author_totals", data.timeframe)
    const rows = t.map((x) => {
      const [followers, published, claps, tips] = [x.followers, x.published, x.claps, x.tips].map(Number)
      const earnings = Number(x.ledger) + tips
      return {
        userId: x.id as string,
        handle: null as string | null,
        displayName: "Anonymous",
        avatarUrl: null as string | null,
        followers,
        published,
        claps,
        tipsPaise: tips,
        earningsPaise: earnings,
        popularityScore: followers * 5 + claps,
        activenessScore: published * 10 + claps,
      }
    })
    rows.sort((a, b) => b.popularityScore - a.popularityScore)
    rows.forEach((r, i) => ((r as { rank?: number }).rank = i + 1))
    return {
      rows: await withProfiles(supabaseAdmin, rows.slice(0, 500)),
      total: rows.length,
      timeframe: data.timeframe,
    }
  }
  return await __handler({ data: args?.data as { timeframe: Timeframe } })
}

// ============ PIECE LEADERBOARD ============
// Public, published pieces ranked by what readers did with them in the window.
// Rows carry the piece id as userId and the title as displayName so the shared
// rank/search/page helper works unchanged; handle is the author's.
export async function pieceLeaderboard(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const timeframe: Timeframe = args?.data?.timeframe ?? "all"
  const live = await totals(supabaseAdmin, "leaderboard_piece_totals", timeframe)
  const score = (p: any) => Number(p.reads) + Number(p.claps) + Number(p.responses) * 3 + Number(p.highlights) * 2 + Number(p.saves) * 2
  const shown = live.sort((a, b) => score(b) - score(a)).slice(0, 500)
  const profiles = await loadProfiles(supabaseAdmin, [...new Set(shown.map((p: any) => p.author_id as string))])
  const rows = shown.map((p: any) => {
    const a = profiles.get(p.author_id)
    const [rd, c, r, h, s] = [p.reads, p.claps, p.responses, p.highlights, p.saves].map(Number)
    return {
      userId: p.id as string,
      displayName: (p.title as string) || "Untitled",
      slug: p.slug as string,
      handle: a?.handle ?? null,
      authorName: a?.display_name ?? "Anonymous",
      avatarUrl: a?.avatar_url ?? null,
      reads: rd,
      claps: c,
      responses: r,
      highlights: h,
      saves: s,
      engagementScore: score(p),
    }
  })
  return { rows, total: live.length, timeframe }
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
