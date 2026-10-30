// Daily platform-funded AI token allowance per plan.
//
// EVERY token counted here is a real bill you pay the AI provider. Keep each
// number at or below what that plan's subscription margin can absorb — a user
// who maxes the cap every day should still be profitable, or a deliberate loss
// leader you've chosen. BYOK (the user's own API key) bypasses all of this and
// costs the platform nothing; treat it as the pressure valve for heavy users.
//
// The defaults below are placeholders, NOT a promise. Do not publish token
// numbers until you have a provider account with a hard spend limit and have
// checked cap x token-price < plan revenue. Until then these are only ceilings.
//
// Two operational seams so you can react without a deploy:
//   - AI_TOKENS_FREE / AI_TOKENS_STUDIO / AI_TOKENS_ORG env vars override the
//     matching default — dial a plan down instantly when spend spikes.
//   - AI_PLATFORM_FUNDED_OFF=1 is a hard kill switch: platform-funded AI stops
//     for everyone (BYOK users keep working). Callers treat a 0 limit as "off".
import { isLaunchFree } from "@/lib/plan"

const DEFAULTS: Record<"free" | "studio" | "org", number> = {
  free: 20_000,
  studio: 250_000,
  org: 1_000_000,
}

export const AI_TOKEN_WINDOW_SECONDS = 86_400 // 24h

function envNum(name: string): number | null {
  const v = process.env[name]
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

// Per-REQUEST ceilings — bound a single AI call so one prompt can't blow a whole
// day's budget (or run up a big one-shot bill) in one go. Output is capped hard
// at the model; oversized input is rejected before the call is ever made. Both
// env-overridable (read at boot). ~4 chars/token, so 24k chars ≈ 6k input tokens.
export const AI_MAX_OUTPUT_TOKENS = envNum("AI_MAX_OUTPUT_TOKENS") ?? 2_000
export const AI_MAX_INPUT_CHARS = envNum("AI_MAX_INPUT_CHARS") ?? 24_000

// Resolve the per-day platform-funded token ceiling for a plan. Returns 0 when
// the kill switch is on — callers block platform-funded AI on a 0 (the limiter
// itself can't enforce a 0 ceiling on a fresh window).
export function aiDailyTokenLimit(plan: string | null | undefined): number {
  if (process.env.AI_PLATFORM_FUNDED_OFF === "1") return 0
  const key: "free" | "studio" | "org" =
    plan === "studio" || plan === "org" ? plan : "free"
  return envNum(`AI_TOKENS_${key.toUpperCase()}`) ?? DEFAULTS[key]
}

// Free launch earns nothing, so everyone gets the free allowance; heavy users
// bring their own key (BYOK), which costs Nib nothing.
export function aiPlanForLimit(plan: string | null | undefined): string {
  return isLaunchFree() ? "free" : (plan ?? "free")
}
