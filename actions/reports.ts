"use server"

import { createAdminClient, createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit.server"

export async function reportContent(
  contentObjectId: string,
  reason: string,
  target?: { type: "piece" | "comment" | "profile"; id: string }
) {
  const supabase = await createAdminClient()
  const { data: authData } = await (await createClient()).auth.getUser()

  // Require a signed-in reporter. Anonymous reports let a bot flood the
  // moderation queue and pressure takedowns of a target with no accountability.
  const userId = authData?.user?.id
  if (!userId) {
    return { success: false, error: "Sign in to report content." }
  }

  // Cap report volume per user so the queue can't be flooded.
  const rl = await checkRateLimit("report_content", userId, 20, 3600)
  if (!rl.ok) {
    return { success: false, error: "Too many reports. Please try again later." }
  }

  const row: Record<string, unknown> = {
    content_object_id: contentObjectId,
    user_id: userId,
    reason,
    status: "pending",
  }
  // Only set target columns when provided so piece reports keep working
  // before the 20260719000000_moderation migration is applied.
  if (target) {
    row.target_type = target.type
    row.target_id = target.id
  }

  // De-dupe: one open report per user per target. A repeated report on the same
  // item is a no-op success, not another queue entry.
  const dedupe = supabase
    .from("content_reports")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
  if (target) {
    dedupe.eq("target_type", target.type).eq("target_id", target.id)
  } else {
    dedupe.eq("content_object_id", contentObjectId)
  }
  const { data: existing } = await dedupe.maybeSingle()
  if (existing) {
    return { success: true }
  }

  const { error } = await supabase.from("content_reports").insert(row)

  if (error) {
    console.error("[server] Failed to submit report:", error)
    return { success: false, error: "Failed to submit report" }
  }

  return { success: true }
}
