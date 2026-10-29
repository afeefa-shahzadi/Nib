/** Tier definitions ordered from highest to lowest. */
export interface TierInfo {
  name: string
  emoji: string
  color: string          // Tailwind text color class
  bgColor: string        // Tailwind bg color class
  borderColor: string    // Tailwind border color class
  minLevel: number
  nextLevel: number | null
}

const TIERS: TierInfo[] = [
  {
    name: "Old Growth",
    emoji: "🌳",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
    minLevel: 50,
    nextLevel: null,
  },
  {
    name: "Canopy",
    emoji: "🍃",
    color: "text-info",
    bgColor: "bg-info/10",
    borderColor: "border-info/30",
    minLevel: 30,
    nextLevel: 50,
  },
  {
    name: "Branch",
    emoji: "🌳",
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/30",
    minLevel: 15,
    nextLevel: 30,
  },
  {
    name: "Sprout",
    emoji: "🌿",
    color: "text-note",
    bgColor: "bg-note/10",
    borderColor: "border-note/30",
    minLevel: 5,
    nextLevel: 15,
  },
  {
    name: "Seedling",
    emoji: "🌱",
    color: "text-muted-foreground",
    bgColor: "bg-muted/10",
    borderColor: "border-border/30",
    minLevel: 1,
    nextLevel: 5,
  },
]

/**
 * Returns the tier for a given level.
 * Tier is computed purely from level — no DB lookup needed.
 */
export function getTier(level: number): TierInfo {
  return TIERS.find((t) => level >= t.minLevel) ?? TIERS[TIERS.length - 1]
}

/**
 * Returns true if oldLevel and newLevel are in different tiers.
 */
export function tierChanged(oldLevel: number, newLevel: number): boolean {
  return getTier(oldLevel).name !== getTier(newLevel).name
}

/**
 * XP required to reach a given level.
 * Formula mirrors claimReward: level = floor(xp / 1000) + 1
 */
export function xpForLevel(level: number): number {
  return (level - 1) * 1000
}

/** XP needed to reach the next level from current XP. */
export function xpToNextLevel(currentXp: number): number {
  const currentLevel = Math.floor(currentXp / 1000) + 1
  const nextLevelXp = xpForLevel(currentLevel + 1)
  return nextLevelXp - currentXp
}

/** Progress within current level (0–1). */
export function levelProgress(currentXp: number): number {
  const levelStart = Math.floor(currentXp / 1000) * 1000
  return (currentXp - levelStart) / 1000
}

/**
 * Insight Points redemption rate: 10,000 IP = ₹100 (₹10,000 = 10,000 paise),
 * so 1 IP = 1 paise. Single source of truth for IP→money conversion.
 */
export const PAISE_PER_IP = 1
export function ipToPaise(points: number): number {
  return Math.floor(points * PAISE_PER_IP)
}

/** Credit cost to restore a streak, scaled by length. */
export function streakRestoreCost(streakLength: number): number {
  if (streakLength >= 100) return 600
  if (streakLength >= 30)  return 300
  if (streakLength >= 7)   return 150
  return 50
}
