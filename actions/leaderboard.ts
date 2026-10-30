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

// PostgREST returns at most 1,000 rows per request; read every page so totals don't silently stop there.
// ponytail: pulls raw rows into memory; move the sums into a Postgres function if tables reach the millions.
const PAGE = 1000
async function selectAll(build: () => any): Promise<any[]> {
  const out: any[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) return out
  }
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
    const since = (q: any, col: string) => (start ? q.gte(col, start) : q)
    const pts = await selectAll(() => since(supabaseAdmin.from("insight_points").select("user_id, points"), "created_at"))
    const points = new Map<string, number>()
    for (const r of pts ?? [])
      points.set(r.user_id, (points.get(r.user_id) ?? 0) + r.points)

    // Claps given (sum of count)
    const cl = await selectAll(() => since(supabaseAdmin.from("piece_claps").select("user_id, count"), "updated_at"))
    const claps = new Map<string, number>()
    for (const r of cl ?? [])
      claps.set(r.user_id, (claps.get(r.user_id) ?? 0) + r.count)

    // Annotations
    const an = await selectAll(() => since(supabaseAdmin.from("block_annotations").select("user_id"), "created_at"))
    const ann = new Map<string, number>()
    for (const r of an ?? []) ann.set(r.user_id, (ann.get(r.user_id) ?? 0) + 1)

    // Follows
    const fo = await selectAll(() => supabaseAdmin.from("follows").select("follower_id"))
    const follows = new Map<string, number>()
    for (const r of fo ?? [])
      follows.set(r.follower_id, (follows.get(r.follower_id) ?? 0) + 1)

    // Streaks (canonical table is user_stats — reading_streaks is legacy/unwritten)
    const st = await selectAll(() => supabaseAdmin.from("user_stats").select("user_id, current_streak, longest_streak"))
    const streak = new Map<string, { current: number; longest: number }>()
    for (const r of st ?? [])
      streak.set(r.user_id, {
        current: r.current_streak ?? 0,
        longest: r.longest_streak ?? 0,
      })

    // Real money a reader earns: the curator share on sales from their collections.
    // Insight points are recognition only and never convert to cash.
    const cu = await selectAll(() => since(supabaseAdmin.from("earnings_ledger").select("user_id, net_paise").eq("source", "curator_share"), "created_at"))
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
    const since = (q: any, col: string) => (start ? q.gte(col, start) : q)
    const fo = await selectAll(() => supabaseAdmin.from("follows").select("author_id"))
    const followers = new Map<string, number>()
    for (const r of fo ?? [])
      followers.set(r.author_id, (followers.get(r.author_id) ?? 0) + 1)

    // Published pieces & piece->author map
    const pieces = await selectAll(() =>
      since(supabaseAdmin.from("content_objects").select("id, author_id, published_at").eq("status", "published").eq("visibility", "public"), "published_at")
    )
    const published = new Map<string, number>()
    const pieceAuthor = new Map<string, string>()
    for (const r of pieces ?? []) {
      published.set(r.author_id, (published.get(r.author_id) ?? 0) + 1)
      pieceAuthor.set(r.id, r.author_id)
    }

    // Claps received — need full piece->author map
    if (start) {
      const allPieces = await selectAll(() => supabaseAdmin.from("content_objects").select("id, author_id"))
      for (const r of allPieces ?? []) pieceAuthor.set(r.id, r.author_id)
    }
    const cl = await selectAll(() => since(supabaseAdmin.from("piece_claps").select("piece_id, count"), "updated_at"))
    const claps = new Map<string, number>()
    for (const r of cl ?? []) {
      const a = pieceAuthor.get(r.piece_id)
      if (a) claps.set(a, (claps.get(a) ?? 0) + r.count)
    }

    // Tips received
    const tips = await selectAll(() => since(supabaseAdmin.from("tips").select("author_id, net_paise").eq("status", "paid"), "created_at"))
    const tipsIn = new Map<string, number>()
    for (const r of tips ?? [])
      tipsIn.set(r.author_id, (tipsIn.get(r.author_id) ?? 0) + (r.net_paise || 0))

    // Earnings ledger
    const ed = await selectAll(() => since(supabaseAdmin.from("earnings_ledger").select("user_id, net_paise"), "created_at"))
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

// ============ PIECE LEADERBOARD ============
// Public, published pieces ranked by what readers did with them in the window.
// Rows carry the piece id as userId and the title as displayName so the shared
// rank/search/page helper works unchanged; handle is the author's.
export async function pieceLeaderboard(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const timeframe: Timeframe = args?.data?.timeframe ?? "all"
  const start = rangeStart(timeframe)
  const since = (q: any, col: string) => (start ? q.gte(col, start) : q)

  const [pieces, cl, rs, hl, sv, fr] = await Promise.all([
    selectAll(() => supabaseAdmin.from("content_objects").select("id, title, slug, author_id").eq("status", "published").eq("visibility", "public")),
    selectAll(() => since(supabaseAdmin.from("piece_claps").select("piece_id, count"), "updated_at")),
    selectAll(() => since(supabaseAdmin.from("piece_responses").select("piece_id, user_id"), "created_at")),
    selectAll(() => since(supabaseAdmin.from("reader_highlights").select("piece_id, user_id"), "created_at")),
    selectAll(() => since(supabaseAdmin.from("collection_items").select("content_object_id, collections(curator_id)"), "created_at")),
    // A full read: scrolled to the end after enough time to read it (see use-telemetry).
    selectAll(() => since(supabaseAdmin.from("telemetry_events").select("piece_id, session").eq("event", "full_read"), "created_at")),
  ])
  // Authors' own responses, highlights and saves don't count (claps on your own piece are refused already).
  const authorOf = new Map((pieces ?? []).map((p: any) => [p.id as string, p.author_id as string]))
  const tally = (list: any[] | null, key: string, who: (r: any) => string | undefined, n: (r: any) => number = () => 1) => {
    const m = new Map<string, number>()
    for (const r of list ?? []) if (r[key] && who(r) !== authorOf.get(r[key])) m.set(r[key], (m.get(r[key]) ?? 0) + n(r))
    return m
  }
  const claps = tally(cl, "piece_id", () => undefined, (r) => r.count)
  const responses = tally(rs, "piece_id", (r) => r.user_id)
  const highlights = tally(hl, "piece_id", (r) => r.user_id)
  const saves = tally(sv, "content_object_id", (r) => r.collections?.curator_id)
  // One read per browser session per piece, so re-reading or refreshing doesn't add up.
  // Authors' own reads are never recorded (see recordTelemetry).
  const reads = new Map<string, number>()
  const seen = new Set<string>()
  for (const r of (fr ?? []) as any[]) {
    const k = `${r.piece_id}|${r.session}`
    if (r.session && seen.has(k)) continue
    seen.add(k)
    reads.set(r.piece_id, (reads.get(r.piece_id) ?? 0) + 1)
  }

  const live = (pieces ?? []).filter((p: any) => reads.has(p.id) || claps.has(p.id) || responses.has(p.id) || highlights.has(p.id) || saves.has(p.id))
  const profiles = await loadProfiles(supabaseAdmin, [...new Set(live.map((p: any) => p.author_id as string))])
  const rows = live.map((p: any) => {
    const a = profiles.get(p.author_id)
    const c = claps.get(p.id) ?? 0
    const r = responses.get(p.id) ?? 0
    const h = highlights.get(p.id) ?? 0
    const s = saves.get(p.id) ?? 0
    return {
      userId: p.id as string,
      displayName: (p.title as string) || "Untitled",
      slug: p.slug as string,
      handle: a?.handle ?? null,
      authorName: a?.display_name ?? "Anonymous",
      avatarUrl: a?.avatar_url ?? null,
      reads: reads.get(p.id) ?? 0,
      claps: c,
      responses: r,
      highlights: h,
      saves: s,
      engagementScore: (reads.get(p.id) ?? 0) + c + r * 3 + h * 2 + s * 2,
    }
  })
  rows.sort((a, b) => b.engagementScore - a.engagementScore)
  return { rows: rows.slice(0, 500), total: rows.length, timeframe }
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
