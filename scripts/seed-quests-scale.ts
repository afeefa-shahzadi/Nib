import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

type StatKey = "pieces_read" | "pieces_written" | "tips_received" | "followers_count" | "current_streak" | "longest_streak"

const TARGET_CEILING = 1_000_000

const TIERS = ["bronze", "silver", "gold", "platinum", "diamond"] as const

interface LadderDef {
  key: StatKey
  name: string
  baseTarget: number
  growthFactor: number
  baseXp: number
  steps: number
}

const ladders: LadderDef[] = [
  { key: "pieces_read", name: "Avid Reader", baseTarget: 10, growthFactor: 1.5, baseXp: 50, steps: 500 },
  { key: "pieces_written", name: "Prolific Writer", baseTarget: 1, growthFactor: 1.3, baseXp: 100, steps: 300 },
  { key: "tips_received", name: "Valued Creator", baseTarget: 5, growthFactor: 1.8, baseXp: 200, steps: 200 },
  { key: "followers_count", name: "Influencer", baseTarget: 10, growthFactor: 1.6, baseXp: 150, steps: 200 },
  { key: "longest_streak", name: "Dedicated", baseTarget: 3, growthFactor: 1.2, baseXp: 100, steps: 365 },
]

async function seed() {
  console.log("Seeding quests and achievements...")

  const achievements = []
  const quests = []

  for (const ladder of ladders) {
    let currentTarget = ladder.baseTarget
    let currentXp = ladder.baseXp

    for (let i = 1; i <= ladder.steps; i++) {
      const roundedTarget = Math.round(currentTarget)
      // Stop after the first step at or above 1M: later steps are unreachable (they used to
      // pile up at a 2e9 cap). Tiers still come from i / steps, so kept steps are unchanged.
      if (roundedTarget >= TARGET_CEILING && i > 1 && Math.round(currentTarget / ladder.growthFactor) >= TARGET_CEILING) break
      const roundedXp = Math.min(1000000000, Math.round(currentXp))

      // Assign tier based on step progress
      const progress = i / ladder.steps
      let tierIndex = Math.floor(progress * TIERS.length)
      if (tierIndex >= TIERS.length) tierIndex = TIERS.length - 1
      const tier = TIERS[tierIndex]

      // Determine numeral (e.g., I, II, III...)
      const numeral = i <= 10 ? ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][i - 1] : i.toString()

      // Achievements
      achievements.push({
        title: `${ladder.name} ${numeral}`,
        description: `Achieve a target of ${roundedTarget} for ${ladder.key.replace('_', ' ')}`,
        tier: tier,
        stat_key: ladder.key,
        target_value: roundedTarget,
        reward_xp: roundedXp * 2, // Achievements give more XP
        icon_url: `https://api.dicebear.com/7.x/shapes/svg?seed=${ladder.key}${i}`
      })

      // Lifetime Quests
      quests.push({
        title: `Quest: ${ladder.name} ${numeral}`,
        description: `Reach ${roundedTarget} ${ladder.key.replace('_', ' ')} to complete this lifetime quest.`,
        quest_type: 'lifetime',
        stat_key: ladder.key,
        target_value: roundedTarget,
        reward_xp: roundedXp,
        reward_credits: Math.round(roundedXp / 10),
        is_active: true
      })

      currentTarget *= ladder.growthFactor
      currentXp *= 1.1 // slower XP growth
    }
  }

  console.log(`Generated ${achievements.length} achievements and ${quests.length} quests.`)

  // Chunk inserts to avoid payload limits
  const chunkSize = 500
  
  // Clear existing
  console.log("Clearing existing data...")
  await supabase.from("quests").delete().neq("id", "00000000-0000-0000-0000-000000000000")
  await supabase.from("achievements").delete().neq("id", "00000000-0000-0000-0000-000000000000")

  console.log("Inserting achievements...")
  for (let i = 0; i < achievements.length; i += chunkSize) {
    const chunk = achievements.slice(i, i + chunkSize)
    const { error } = await supabase.from("achievements").insert(chunk)
    if (error) console.error("Error inserting achievements chunk", error)
  }

  console.log("Inserting quests...")
  for (let i = 0; i < quests.length; i += chunkSize) {
    const chunk = quests.slice(i, i + chunkSize)
    const { error } = await supabase.from("quests").insert(chunk)
    if (error) console.error("Error inserting quests chunk", error)
  }

  console.log("Done seeding!")
}

seed().catch(console.error)
