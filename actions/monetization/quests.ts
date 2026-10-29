/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createServiceRoleClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"
import { getTier, tierChanged, streakRestoreCost } from "@/lib/tier"
import { isLaunchFree } from "@/lib/plan"
import { utcDay, streakStep, isStaleDailyQuest } from "@/lib/streak"

// Grace window: 47 hours (same-day + next day, like Snapchat)
const RESTORE_WINDOW_HOURS = 47

export async function tickReadingStreak() {
  const authClient = await createClient()
  const { data: _auth } = await authClient.auth.getUser()
  // Identity from the cookie client; insight_points/user_stats/profiles writes
  // are RLS-denied to `authenticated`, so reads/writes use the service role.
  const supabaseAdmin = await createServiceRoleClient()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    const { userId } = context
    if (!userId) {
      return { streak: 0, longest: 0, awarded: false, bonus: 0, broke: false, previousStreak: 0, canRestore: false, restoresLeft: 0, isNewRecord: false }
    }

    // Auto-create user_stats if not exists
    await supabaseAdmin.from("user_stats").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true })

    const todayStr = utcDay()

    const { data: cur } = await supabaseAdmin
      .from("user_stats")
      .select("current_streak, longest_streak, last_active_date, streak_restores_used, streak_restores_month, streak_broken_at, streak_broken_value")
      .eq("user_id", userId)
      .maybeSingle()

    if (!cur) {
      return { streak: 0, longest: 0, awarded: false, bonus: 0, broke: false, previousStreak: 0, canRestore: false, isNewRecord: false }
    }

    // Already ticked today — return current state
    if (cur.last_active_date === todayStr) {
      return {
        streak: cur.current_streak,
        longest: cur.longest_streak,
        awarded: false,
        bonus: 0,
        broke: false,
        previousStreak: 0,
        canRestore: false,
        isNewRecord: false,
      }
    }

    const month = todayStr.slice(0, 7) // YYYY-MM
    const restoresUsed =
      cur.streak_restores_month === month ? (cur.streak_restores_used ?? 0) : 0

    // One free freeze per month forgives a single missed day; longer gaps break.
    const { streak, broke, frozen, previousStreak } = streakStep({
      lastActive: cur.last_active_date ?? null,
      today: todayStr,
      current: cur.current_streak ?? 0,
      freezeAvailable: restoresUsed < 1,
    })

    const prevLongest = cur.longest_streak ?? 0
    const longest = Math.max(streak, prevLongest)
    const isNewRecord = streak > prevLongest && streak > 1

    const updatePayload: Record<string, unknown> = {
      current_streak: streak,
      longest_streak: longest,
      last_active_date: todayStr,
      updated_at: new Date().toISOString(),
    }

    if (broke) {
      updatePayload.streak_broken_at = new Date().toISOString()
      updatePayload.streak_broken_value = previousStreak
    } else {
      updatePayload.streak_broken_at = null
      updatePayload.streak_broken_value = 0
    }

    if (frozen) {
      updatePayload.streak_restores_used = restoresUsed + 1
      updatePayload.streak_restores_month = month
    }

    // Compare-and-set on last_active_date: a concurrent tick loses here and must
    // not re-award the milestone bonus.
    const { data: won } = await supabaseAdmin
      .from("user_stats")
      .update(updatePayload)
      .eq("user_id", userId)
      .or(`last_active_date.is.null,last_active_date.neq.${todayStr}`)
      .select("user_id")
    if (!won?.length) {
      return { streak: cur.current_streak, longest: cur.longest_streak, awarded: false, bonus: 0, broke: false, previousStreak: 0, canRestore: false, isNewRecord: false }
    }

    // Milestone IP bonus on the canonical (visible) streak. Values match the
    // /earn copy: 7-day +50, 30-day +250, 100-day +1000. Only fires the day the
    // streak reaches the milestone (streak is monotonic +1/day, so no dupes).
    const STREAK_BONUS: Record<number, number> = { 7: 50, 30: 250, 100: 1000 }
    const bonus = STREAK_BONUS[streak] ?? 0
    if (bonus > 0) {
      await supabaseAdmin.from("insight_points").insert({
        user_id: userId,
        points: bonus,
        reason: `streak_bonus_${streak}`,
      })
    }

    // canRestore: broke this session. Credit check happens in restoreStreak().
    return { streak, longest, awarded: false, bonus, broke, previousStreak, canRestore: broke, isNewRecord, frozen }
  }

  return await __handler({ context })
}

export async function restoreStreak() {
  const authClient = await createClient()
  const { data: _auth } = await authClient.auth.getUser()
  // Identity from the cookie client; insight_points/user_stats/profiles writes
  // are RLS-denied to `authenticated`, so reads/writes use the service role.
  const supabaseAdmin = await createServiceRoleClient()
  if (!_auth?.user) return { success: false, reason: "unauthorized" as const }

  const userId = _auth.user.id

  // Fetch user_stats and credits balance in parallel
  const [{ data: cur }, { data: profileData }] = await Promise.all([
    supabaseAdmin
      .from("user_stats")
      .select("streak_broken_at, streak_broken_value")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .maybeSingle(),
  ])

  if (!cur) return { success: false, reason: "no_stats" as const }
  if (!cur.streak_broken_at || !cur.streak_broken_value) return { success: false, reason: "no_break" as const }

  // Check restore window (47 hours)
  const brokeAt = new Date(cur.streak_broken_at)
  const hoursSinceBroke = (Date.now() - brokeAt.getTime()) / 1000 / 3600
  if (hoursSinceBroke > RESTORE_WINDOW_HOURS) return { success: false, reason: "window_expired" as const }

  const restoredStreak = cur.streak_broken_value
  const cost = streakRestoreCost(restoredStreak)
  const currentCredits = profileData?.credits ?? 0

  if (currentCredits < cost) {
    return {
      success: false,
      reason: "insufficient_credits" as const,
      cost,
      currentCredits,
    }
  }

  // Claim the break first (compare-and-set on streak_broken_at) so concurrent
  // restores can't both pay/apply; refund if the charge then loses its own race.
  const { data: claimed } = await supabaseAdmin.from("user_stats").update({
    current_streak: restoredStreak,
    streak_broken_at: null,
    streak_broken_value: 0,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId).eq("streak_broken_at", cur.streak_broken_at).select("user_id")
  if (!claimed?.length) return { success: false, reason: "no_break" as const }

  const { data: charged } = await supabaseAdmin.from("profiles")
    .update({ credits: currentCredits - cost })
    .eq("id", userId).eq("credits", currentCredits).select("id")
  if (!charged?.length) {
    await supabaseAdmin.from("user_stats").update({
      current_streak: 1,
      streak_broken_at: cur.streak_broken_at,
      streak_broken_value: restoredStreak,
    }).eq("user_id", userId)
    return { success: false, reason: "insufficient_credits" as const, cost, currentCredits }
  }

  return {
    success: true as const,
    restoredStreak,
    creditsSpent: cost,
    remainingCredits: currentCredits - cost,
  }
}

export async function consumeListeningCredit() {
  const authClient = await createClient()
  const { data: _auth } = await authClient.auth.getUser()
  // Identity from the cookie client; insight_points/user_stats/profiles writes
  // are RLS-denied to `authenticated`, so reads/writes use the service role.
  const supabaseAdmin = await createServiceRoleClient()
  if (!_auth?.user) return { success: false, reason: "unauthorized" as const }

  const userId = _auth.user.id

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("credits, disability_visual")
    .eq("id", userId)
    .maybeSingle()

  const currentCredits = profile?.credits ?? 0

  if (profile?.disability_visual === true || isLaunchFree()) {
    return {
      success: true as const,
      remainingCredits: currentCredits,
      bypassed: true,
    }
  }

  if (currentCredits < 1) {
    return {
      success: false,
      reason: "insufficient_credits" as const,
      currentCredits,
    }
  }

  await supabaseAdmin.from("profiles").update({
    credits: currentCredits - 1,
  }).eq("id", userId)

  return {
    success: true as const,
    remainingCredits: currentCredits - 1,
  }
}

export async function myQuestStatus() {
  const authClient = await createClient()
  const { data: _auth } = await authClient.auth.getUser()
  // Identity from the cookie client; insight_points/user_stats/profiles writes
  // are RLS-denied to `authenticated`, so reads/writes use the service role.
  const supabaseAdmin = await createServiceRoleClient()
  if (!_auth?.user) return null

  // 1. Get user_stats and profile
  const { data: stats } = await supabaseAdmin
    .from("user_stats")
    .select("*")
    .eq("user_id", _auth.user.id)
    .maybeSingle()

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("xp, level, credits")
    .eq("id", _auth.user.id)
    .maybeSingle()

  const safeStats: Record<string, number> = {
    pieces_read: stats?.pieces_read || 0,
    pieces_written: stats?.pieces_written || 0,
    tips_received: stats?.tips_received || 0,
    followers_count: stats?.followers_count || 0,
    current_streak: stats?.current_streak || 0,
    longest_streak: stats?.longest_streak || 0
  }

  // 2. Fetch User Claims
  const { data: claims } = await supabaseAdmin
    .from("user_reward_claims")
    .select("item_id")
    .eq("user_id", _auth.user.id)
  
  const claimedItemIds = new Set((claims || []).map(c => c.item_id))

  // 3. Generate or Fetch Today's Daily Quests
  const todayDateStr = utcDay()
  const dailyTitle1 = `Daily Login (${todayDateStr})`
  const dailyTitle2 = `Daily Reader (${todayDateStr})`

  let { data: dailyQuests } = await supabaseAdmin
    .from("quests")
    .select("*")
    .in("title", [dailyTitle1, dailyTitle2])

  if (!dailyQuests || dailyQuests.length < 2) {
    // Ensure both exist
    const toInsert = []
    if (!dailyQuests?.find(q => q.title === dailyTitle1)) {
      toInsert.push({ title: dailyTitle1, description: "Log in to Nib today.", quest_type: "daily", stat_key: "daily_login", target_value: 1, reward_xp: 25, reward_credits: 5, is_active: true })
    }
    if (!dailyQuests?.find(q => q.title === dailyTitle2)) {
      toInsert.push({ title: dailyTitle2, description: "Read at least 1 piece today.", quest_type: "daily", stat_key: "daily_read", target_value: 1, reward_xp: 50, reward_credits: 10, is_active: true })
    }
    if (toInsert.length > 0) {
      // Unique index on daily titles: a concurrent first-load loses with 23505
      // (ignored) and we just read the winner's rows below.
      for (const row of toInsert) await supabaseAdmin.from("quests").insert(row)
      const { data: refreshed } = await supabaseAdmin.from("quests").select("*").in("title", [dailyTitle1, dailyTitle2])
      dailyQuests = refreshed || []
    }
  }

  // Check progress for daily quests
  // Login is automatic if they are here
  const dailyLoginProgress = 1
  let dailyReadProgress = 0

  const { count: readCount } = await supabaseAdmin
    .from("telemetry_events")
    .select("*", { count: 'exact', head: true })
    .eq("viewer_id", _auth.user.id)
    .eq("event", "full_read")
    .gte("created_at", `${todayDateStr}T00:00:00Z`)
  
  if (readCount && readCount > 0) {
    dailyReadProgress = 1
  }

  const processedDaily = (dailyQuests || []).map(q => {
    const progress = q.stat_key === "daily_login" ? dailyLoginProgress : dailyReadProgress
    return {
      ...q,
      current: progress,
      is_claimed: claimedItemIds.has(q.id),
      can_claim: progress >= q.target_value && !claimedItemIds.has(q.id)
    }
  })

  // 4. Fetch Next Progression Quests & Achievements
  // Instead of fetching all 3000 rows, we can fetch all and filter in memory since Supabase JS doesn't easily let us fetch "first uncompleted per category".
  // Wait, fetching 3000 rows is what we want to avoid.
  // Better: We only fetch quests that the user hasn't claimed yet, and take the lowest target_value for each stat_key.
  // We can query uncompleted quests directly if we filter out claimedItemIds, but Supabase doesn't have `.not.in("id", Array)` if the array is 1500 items long (could be too large).
  // Alternatively, since we know user's current stats, we can just fetch where target_value > current_stat!

  const statKeys = ["pieces_read", "pieces_written", "tips_received", "followers_count", "longest_streak"]
  let nextQuests: any[] = []
  let nextAchievements: any[] = []

  for (const key of statKeys) {
    const currentVal = safeStats[key] || 0
    // Fetch next quest
    const { data: nq } = await supabaseAdmin
      .from("quests")
      .select("*")
      .eq("quest_type", "lifetime")
      .eq("stat_key", key)
      .gt("target_value", currentVal)
      .order("target_value", { ascending: true })
      .limit(1)
      .maybeSingle()
    if (nq) nextQuests.push(nq)

    // Fetch next achievement
    const { data: na } = await supabaseAdmin
      .from("achievements")
      .select("*")
      .eq("stat_key", key)
      .gt("target_value", currentVal)
      .order("target_value", { ascending: true })
      .limit(1)
      .maybeSingle()
    if (na) nextAchievements.push(na)
  }

  // Also include any quests/achievements that are completed but NOT claimed!
  // To avoid fetching all 1500, we query for target_value <= currentVal. Then we filter out the ones already claimed.
  for (const key of statKeys) {
    const currentVal = safeStats[key] || 0
    if (currentVal > 0) {
       const { data: completableQuests } = await supabaseAdmin
         .from("quests")
         .select("*")
         .eq("quest_type", "lifetime")
         .eq("stat_key", key)
         .lte("target_value", currentVal)
         .order("target_value", { ascending: false })

       if (completableQuests) {
          // Walk highest->lowest so the lowest unclaimed one ends up shown (claim in order).
          completableQuests.forEach(q => {
            if (!claimedItemIds.has(q.id)) {
              // Replace the "next" quest for this key with the completable one so they can claim it first
              nextQuests = nextQuests.filter(nq => nq.stat_key !== key)
              nextQuests.push(q)
            }
          })
       }

       const { data: completableAchievements } = await supabaseAdmin
         .from("achievements")
         .select("*")
         .eq("stat_key", key)
         .lte("target_value", currentVal)
         .order("target_value", { ascending: false })

       if (completableAchievements) {
          completableAchievements.forEach(a => {
            if (!claimedItemIds.has(a.id)) {
              nextAchievements = nextAchievements.filter(na => na.stat_key !== key)
              nextAchievements.push(a)
            }
          })
       }
    }
  }

  // Deduplicate and map
  const uniqueQuests = Array.from(new Map(nextQuests.map(q => [q.id, q])).values())
  const uniqueAchievements = Array.from(new Map(nextAchievements.map(a => [a.id, a])).values())

  const processedLifetime = uniqueQuests.map(q => ({
    ...q,
    current: safeStats[q.stat_key as keyof typeof safeStats] || 0,
    is_claimed: claimedItemIds.has(q.id),
    can_claim: (safeStats[q.stat_key as keyof typeof safeStats] || 0) >= Number(q.target_value) && !claimedItemIds.has(q.id)
  }))

  const processedAchievements = uniqueAchievements.map(a => ({
    ...a,
    current: safeStats[a.stat_key as keyof typeof safeStats] || 0,
    is_claimed: claimedItemIds.has(a.id),
    can_claim: (safeStats[a.stat_key as keyof typeof safeStats] || 0) >= Number(a.target_value) && !claimedItemIds.has(a.id)
  }))

  return {
    stats: safeStats,
    profile: {
      xp: profile?.xp || 0,
      level: profile?.level || 1,
      credits: profile?.credits || 0,
    },
    quests: [...processedDaily, ...processedLifetime].slice(0, 5), // Show exactly 5 quests (2 daily + 3 lifetime)
    achievements: processedAchievements
  }
}

// Server-side value of a quest/achievement's tracked stat for a user. Mirrors the
// stat sources myQuestStatus displays, so claimReward can verify the reward was
// actually earned instead of trusting the client to only call it when eligible.
async function currentStatValue(
  svc: Awaited<ReturnType<typeof createServiceRoleClient>>,
  userId: string,
  statKey: string
): Promise<number> {
  if (statKey === "daily_login") return 1 // authenticated caller = logged in today
  if (statKey === "daily_read") {
    const today = utcDay()
    const { count } = await svc
      .from("telemetry_events")
      .select("*", { count: "exact", head: true })
      .eq("viewer_id", userId)
      .eq("event", "full_read")
      .gte("created_at", `${today}T00:00:00Z`)
    return count && count > 0 ? 1 : 0
  }
  const { data } = await svc.from("user_stats").select("*").eq("user_id", userId).maybeSingle()
  const v = (data as Record<string, unknown> | null)?.[statKey]
  return typeof v === "number" ? v : 0
}

export async function claimReward(itemId: string, type: "quest" | "achievement") {
  const authClient = await createClient()
  const { data: _auth } = await authClient.auth.getUser()
  // Identity from the cookie client; insight_points/user_stats/profiles writes
  // are RLS-denied to `authenticated`, so reads/writes use the service role.
  const supabaseAdmin = await createServiceRoleClient()
  if (!_auth?.user) throw new Error("Unauthorized")

  // Check if already claimed
  const { data: existing } = await supabaseAdmin
    .from("user_reward_claims")
    .select("id")
    .eq("user_id", _auth.user.id)
    .eq("item_id", itemId)
    .maybeSingle()

  if (existing) return { success: false, reason: "already_claimed" }

  // Get item definition
  const table = type === "quest" ? "quests" : "achievements"
  const { data: item } = await supabaseAdmin
    .from(table)
    .select("*")
    .eq("id", itemId)
    .single()

  if (!item) throw new Error("Item not found")

  // Daily quests are one row per date; yesterday's must not be claimable today
  // (the daily_read check only looks at today's reads).
  if (type === "quest" && isStaleDailyQuest(item, utcDay())) return { success: false, reason: "expired" }

  // Verify the reward was actually earned — the client-side `can_claim` gate is
  // display only; without this a user could claim any reward id outright.
  const current = await currentStatValue(supabaseAdmin, _auth.user.id, item.stat_key)
  if (current < Number(item.target_value)) return { success: false, reason: "not_earned" }

  // Insert claim. The unique (user_id, item_id) index is the serialization
  // point: two concurrent claims both pass the check above, but only one insert
  // succeeds — the loser bails here instead of double-awarding XP/credits.
  const { error: claimErr } = await supabaseAdmin.from("user_reward_claims").insert({
    user_id: _auth.user.id,
    item_type: type,
    item_id: itemId
  })
  if (claimErr) return { success: false, reason: "already_claimed" }

  // Award XP/credits/level with one atomic SQL increment so concurrent claims
  // of different items can't overwrite each other's award.
  const { data: awarded, error: awardErr } = await supabaseAdmin.rpc("claim_award", {
    p_user: _auth.user.id,
    p_xp: item.reward_xp || 0,
    p_credits: item.reward_credits || 0,
  })
  if (awardErr) throw new Error("Award failed")
  const row = Array.isArray(awarded) ? awarded[0] : awarded
  const currentLevel = row?.old_level ?? 1
  const newLevel = row?.new_level ?? currentLevel

  const leveledUp = newLevel > currentLevel
  const tierInfo = leveledUp && tierChanged(currentLevel, newLevel)
    ? { from: getTier(currentLevel), to: getTier(newLevel) }
    : null

  return {
    success: true as const,
    reward_xp: item.reward_xp,
    reward_credits: item.reward_credits || 0,
    new_level: leveledUp ? newLevel : null,
    tier_changed: tierInfo,
  }
}

export async function monthlyLeaderboard() {
  const supabaseAdmin = await createAdminClient()
  const { data: rows } = await supabaseAdmin
    .from("profiles")
    .select("id, handle, display_name, avatar_url, xp, level")
    .order("xp", { ascending: false })
    .limit(100)

  return {
    entries: (rows || []).map((p, i) => ({
      rank: i + 1,
      userId: p.id,
      points: p.xp || 0,
      level: p.level || 1,
      handle: p.handle,
      displayName: p.display_name || "Anonymous",
      avatarUrl: p.avatar_url
    }))
  }
}

export async function streakLeaderboard() {
  const supabaseAdmin = await createAdminClient()

  // Join user_stats with profiles to get streak data + display info
  const { data: rows } = await supabaseAdmin
    .from("user_stats")
    .select("user_id, current_streak, longest_streak, last_active_date, profiles(handle, display_name, avatar_url)")
    .order("current_streak", { ascending: false })
    .limit(50)

  const today = new Date().toISOString().slice(0, 10)

  return {
    entries: (rows || []).map((r, i) => {
      const p = r.profiles as { handle?: string; display_name?: string; avatar_url?: string } | null
      // Mark as "active today" if last_active_date is today
      const isActiveToday = r.last_active_date === today
      return {
        rank: i + 1,
        userId: r.user_id,
        currentStreak: r.current_streak || 0,
        longestStreak: r.longest_streak || 0,
        isActiveToday,
        handle: p?.handle,
        displayName: p?.display_name || "Anonymous",
        avatarUrl: p?.avatar_url
      }
    })
  }
}
