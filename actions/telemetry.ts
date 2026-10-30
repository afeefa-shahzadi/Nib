/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"

// PUBLIC: record one telemetry event. Anonymous OK. Cheap, non-blocking on the client side.
export async function recordTelemetry(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: authData } = await (await createClient()).auth.getUser()
  const authUserId = authData?.user?.id ?? null

  const __handler = async ({
    data,
  }: {
    data: {
      piece_id: string
      viewer_id?: string | null
      event: string
      mode?: string | null
      depth?: number | null
      session?: string | null
      payload?: Record<string, unknown> | null
    }
  }) => {
    // verify piece exists & is at least author-visible to prevent garbage rows
    const { data: piece } = await supabaseAdmin
      .from("content_objects")
      .select("id, author_id")
      .eq("id", data.piece_id)
      .eq("status", "published")
      .maybeSingle()
    if (!piece) return { ok: false }
    // Authors reading their own piece don't count as readers (analytics, leaderboard).
    if (authUserId && piece.author_id === authUserId) return { ok: true, skipped: true }
    const { error } = await supabaseAdmin.from("telemetry_events").insert({
      piece_id: data.piece_id,
      content_object_id: data.piece_id, // Satisfy old NOT NULL constraint
      event: data.event,
      event_type: data.event, // Satisfy old NOT NULL constraint
      mode: data.mode ?? null,
      depth: data.depth ?? null,
      session: data.session ?? null,
      payload: (data.payload ?? {}) as never,
    })
    if (error) {
      if (error.code !== "PGRST204") {
        console.error("[telemetry]", error)
      }
      return { ok: false }
    }
    // Award the read quest only to the authenticated caller — never trust a
    // client-supplied viewer_id (it would inflate arbitrary users' progress).
    if (data.event === "view" && authUserId && data.viewer_id === authUserId) {
      const { checkReadThreshold } = await import("@/lib/quests.server")
      await checkReadThreshold(authUserId)
    }
    // A genuine full read bumps the lifetime pieces_read counter (feeds the
    // "Avid Reader" ladder). Only the authenticated reader's own event counts.
    if (data.event === "full_read" && authUserId && data.viewer_id === authUserId) {
      const { bumpUserStat } = await import("@/lib/quests.server")
      await bumpUserStat(authUserId, "pieces_read")
    }
    return { ok: true }
  }
  return await __handler({
    data: args?.data as {
      piece_id: string
      viewer_id?: string | null
      event: string
      mode?: string | null
      depth?: number | null
      session?: string | null
      payload?: Record<string, unknown> | null
    },
  })
}

// AUTHOR: aggregated telemetry across own pieces (last N days)
export async function getAuthorTelemetry(args: { data?: any } = {}) {
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
    data: { days: number }
    context: ActionContext
  }) => {
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString()
    const { data: pieces } = await context.supabase
      .from("content_objects")
      .select("id, title, slug")
      .eq("author_id", context.userId!)
    const ids = (pieces ?? []).map((p: { id: string }) => p.id)
    if (ids.length === 0) {
      return {
        days: data.days,
        series: [],
        modes: [],
        topPieces: [],
        totals: {
          views: 0,
          depth25: 0,
          depth50: 0,
          depth100: 0,
          modeSwitches: 0,
          shares: 0,
        },
      }
    }
    const { data: events } = await supabaseAdmin
      .from("telemetry_events")
      .select("piece_id, event, mode, depth, session, created_at")
      .in("piece_id", ids)
      .gte("created_at", since)
      .limit(50_000)
    const rows: Array<{
      piece_id: string
      event: string
      mode: string | null
      depth: number | null
      session: string | null
      created_at: string
    }> = events ?? []

    // daily series
    const byDay = new Map<
      string,
      {
        date: string
        views: number
        uniqueViews: number
        fullReads: number
        depth25: number
        depth50: number
        depth100: number
        shares: number
      }
    >()
    for (let i = data.days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000)
      const key = d.toISOString().slice(0, 10)
      byDay.set(key, {
        date: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
        views: 0,
        uniqueViews: 0,
        fullReads: 0,
        depth25: 0,
        depth50: 0,
        depth100: 0,
        shares: 0,
      })
    }
    const modeCounts: Record<string, number> = {
      skim: 0,
      standard: 0,
      expert: 0,
      teach: 0,
      debate: 0,
    }
    const pieceTotals = new Map<string, { views: number; uniqueViews: number; fullReads: number; depth50: number }>()
    let depth25 = 0,
      depth50 = 0,
      depth100 = 0,
      modeSwitches = 0,
      shares = 0,
      totalViews = 0,
      totalUniqueViews = 0,
      totalFullReads = 0

    const seenSessions = new Set<string>()
    const pieceSeenSessions = new Map<string, Set<string>>()
    const daySeenSessions = new Map<string, Set<string>>()

    for (const r of rows) {
      const key = r.created_at.slice(0, 10)
      const bucket = byDay.get(key)
      const pt = pieceTotals.get(r.piece_id) ?? {
        views: 0,
        uniqueViews: 0,
        fullReads: 0,
        depth50: 0,
      }
      
      const sessionKey = `${r.piece_id}:${r.session ?? 'anon'}`
      
      if (r.event === "view") {
        totalViews++
        pt.views++
        if (bucket) bucket.views++
        
        // Track unique views
        if (!seenSessions.has(sessionKey)) {
          seenSessions.add(sessionKey)
          totalUniqueViews++
        }
        
        let pSet = pieceSeenSessions.get(r.piece_id)
        if (!pSet) { pSet = new Set(); pieceSeenSessions.set(r.piece_id, pSet); }
        if (!pSet.has(sessionKey)) {
          pSet.add(sessionKey)
          pt.uniqueViews++
        }
        
        let dSet = daySeenSessions.get(key)
        if (!dSet) { dSet = new Set(); daySeenSessions.set(key, dSet); }
        if (!dSet.has(sessionKey)) {
          dSet.add(sessionKey)
          if (bucket) bucket.uniqueViews++
        }

        // Count initial mode from view events
        if (r.mode && modeCounts[r.mode] !== undefined) {
          modeCounts[r.mode]++
        }
      } else if (r.event === "full_read") {
        totalFullReads++
        pt.fullReads++
        if (bucket) bucket.fullReads++
      } else if (r.event === "read_depth" && typeof r.depth === "number") {
        if (r.depth >= 25) {
          depth25++
          if (bucket) bucket.depth25++
        }
        if (r.depth >= 50) {
          depth50++
          pt.depth50++
          if (bucket) bucket.depth50++
        }
        if (r.depth >= 100) {
          depth100++
          if (bucket) bucket.depth100++
        }
      } else if (r.event === "mode_switch") {
        modeSwitches++
        if (r.mode && modeCounts[r.mode] !== undefined) modeCounts[r.mode]++
      } else if (r.event === "share") {
        shares++
        if (bucket) bucket.shares++
      }
      pieceTotals.set(r.piece_id, pt)
    }

    const pieceMap = new Map(
      (pieces ?? []).map((p: { id: string; title: string; slug: string }) => [
        p.id,
        p,
      ])
    )
    const topPieces = [...pieceTotals.entries()]
      .map(([id, t]) => ({
        id,
        title: pieceMap.get(id)?.title ?? "(untitled)",
        slug: pieceMap.get(id)?.slug ?? "",
        views: t.views,
        uniqueViews: t.uniqueViews,
        fullReads: t.fullReads,
        reads: t.depth50,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8)

    const modes = Object.entries(modeCounts).map(([name, value]) => ({
      name,
      value,
    }))

    return {
      days: data.days,
      series: [...byDay.values()],
      modes,
      topPieces,
      totals: {
        views: totalViews,
        uniqueViews: totalUniqueViews,
        fullReads: totalFullReads,
        depth25,
        depth50,
        depth100,
        modeSwitches,
        shares,
      },
    }
  }
  return await __handler({
    data: args?.data as { days: number },
    context,
  })
}
