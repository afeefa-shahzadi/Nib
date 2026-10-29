export type Plan = "free" | "studio" | "org" | "reader"

/**
 * Free launch: every paid-tier feature is unlocked for everyone until the
 * paid release. Set LAUNCH_FREE=0 to restore plan gating. Read at call time.
 */
export function isLaunchFree(): boolean {
  return process.env.LAUNCH_FREE !== "0"
}

/**
 * Studio-tier feature access: custom domain, analytics, gating, tiers,
 * bundles, export. Org seats inherit all Studio perks.
 * Single source of truth — was duplicated as `plan === "studio" || plan === "org"`
 * across analytics/settings/tiers/bundles/export.
 */
export function hasStudioAccess(plan: string | null | undefined): boolean {
  return isLaunchFree() || plan === "studio" || plan === "org"
}

export function hasOrgAccess(plan: string | null | undefined): boolean {
  return isLaunchFree() || plan === "org"
}

/** Server-side gate for anything that moves real money. Throws while the free launch is on. */
export function assertPaymentsOpen(): void {
  if (isLaunchFree()) throw new Error("Payments are paused during the free launch.")
}
