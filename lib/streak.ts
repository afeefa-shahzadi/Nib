// Pure streak/day-boundary helpers. All days are UTC calendar days so server
// timezone never changes the answer (the old code mixed local midnight with UTC).

export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10)

/** ISO instant of 00:00 UTC on `d`'s day / first of its month. */
export const utcDayStart = (d = new Date()) => `${utcDay(d)}T00:00:00.000Z`
export const utcMonthStart = (d = new Date()) => `${utcDay(d).slice(0, 7)}-01T00:00:00.000Z`

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return utcDay(d)
}

export type StreakStep = { streak: number; broke: boolean; frozen: boolean; previousStreak: number }

/**
 * Next streak value for a first activity on `today`.
 * Consecutive day -> +1. Exactly ONE missed day with the monthly free freeze
 * unspent -> +1 and frozen. Anything longer (or freeze spent) -> broken, streak 1.
 */
export function streakStep(a: { lastActive: string | null; today: string; current: number; freezeAvailable: boolean }): StreakStep {
  const cur = a.current || 0
  if (!a.lastActive) return { streak: 1, broke: false, frozen: false, previousStreak: 0 }
  if (a.lastActive === addDays(a.today, -1)) return { streak: cur + 1, broke: false, frozen: false, previousStreak: 0 }
  if (a.lastActive === addDays(a.today, -2) && a.freezeAvailable) return { streak: cur + 1, broke: false, frozen: true, previousStreak: 0 }
  return { streak: 1, broke: true, frozen: false, previousStreak: cur }
}

/** Daily quests are titled "... (YYYY-MM-DD)"; only today's may be claimed. */
export function isStaleDailyQuest(q: { quest_type?: string | null; title?: string | null }, today: string): boolean {
  return q.quest_type === "daily" && !(q.title ?? "").endsWith(`(${today})`)
}
