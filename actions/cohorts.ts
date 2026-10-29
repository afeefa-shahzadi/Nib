"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"

export async function getAuthorCohorts() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    // 1. Get all followers to define cohorts
    const { data: follows } = await context.supabase
      .from("follows")
      .select("follower_id, created_at")
      .eq("author_id", context.userId!)

    if (!follows || follows.length === 0) {
      return { cohorts: [] }
    }

    const followers = follows.filter((f) => f.follower_id)
    const followerIds = followers.map((f) => f.follower_id)

    // Group followers by Month (YYYY-MM)
    const cohortMap = new Map<string, Set<string>>()
    const userToCohort = new Map<string, string>()

    for (const f of followers) {
      const month = f.created_at.slice(0, 7) // "YYYY-MM"
      if (!cohortMap.has(month)) cohortMap.set(month, new Set())
      cohortMap.get(month)!.add(f.follower_id)
      userToCohort.set(f.follower_id, month)
    }

    // 2. Get author's pieces
    const { data: pieces } = await context.supabase
      .from("content_objects")
      .select("id")
      .eq("author_id", context.userId!)

    const pieceIds = (pieces ?? []).map((p: { id: string }) => p.id)

    if (pieceIds.length === 0) {
      return { cohorts: [] }
    }

    // 3. Get view events from these followers on these pieces
    const { data: views } = await supabaseAdmin
      .from("telemetry_events")
      .select("viewer_id, created_at")
      .in("piece_id", pieceIds)
      .eq("event", "view")
      .in("viewer_id", followerIds)

    // 4. Calculate Retention
    // Structure: { [cohortMonth]: { size: number, month0: % , month1: %, month2: % } }
    const cohortData: Record<
      string,
      { cohort: string; size: number; [key: `month${number}`]: number }
    > = {}

    for (const [month, usersSet] of cohortMap.entries()) {
      cohortData[month] = { cohort: month, size: usersSet.size }
    }

    // Track unique users per cohort per relative month
    const retentionCounts = new Map<string, Map<number, Set<string>>>()

    for (const view of views ?? []) {
      if (!view.viewer_id) continue
      const cohort = userToCohort.get(view.viewer_id)
      if (!cohort) continue

      // Calculate relative month
      const followDate = new Date(cohort + "-01")
      const viewDate = new Date(view.created_at.slice(0, 7) + "-01")
      const monthDiff =
        (viewDate.getFullYear() - followDate.getFullYear()) * 12 +
        (viewDate.getMonth() - followDate.getMonth())

      if (monthDiff >= 0 && monthDiff <= 12) {
        // Track up to 12 months
        if (!retentionCounts.has(cohort)) retentionCounts.set(cohort, new Map())
        const cohortMonths = retentionCounts.get(cohort)!
        if (!cohortMonths.has(monthDiff)) cohortMonths.set(monthDiff, new Set())
        cohortMonths.get(monthDiff)!.add(view.viewer_id)
      }
    }

    // Compute percentages
    const result = Object.values(cohortData)
      .map((c) => {
        const cohortMonths = retentionCounts.get(c.cohort)
        if (cohortMonths) {
          for (let i = 0; i <= 6; i++) {
            const count = cohortMonths.get(i)?.size || 0
            c[`month${i}`] = Math.round((count / c.size) * 100)
          }
        } else {
          for (let i = 0; i <= 6; i++) c[`month${i}`] = 0
        }
        return c
      })
      .sort((a, b) => b.cohort.localeCompare(a.cohort)) // newest first

    return { cohorts: result }
  }

  return await __handler({ context })
}
