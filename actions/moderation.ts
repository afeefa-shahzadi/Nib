"use server"

import { createServiceRoleClient, createClient } from "@/lib/supabase/server"
import { applyStrike, clearRestriction } from "@/lib/restrictions"

// Asserts the caller has the 'admin' role. Returns a service-role client + caller id.
// Identity comes from the cookie-aware client (the verified session); the role
// check and all downstream admin work run on the service-role client, because
// RLS/table grants would hide other users' rows and block writes.
export async function requireAdmin() {
  const auth = await createClient()
  const { data: authData } = await auth.auth.getUser()
  const userId = authData?.user?.id
  if (!userId) throw new Error("Unauthorized")

  const supabaseAdmin = await createServiceRoleClient()
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
  if (error || !(data ?? []).some((r: { role: string }) => r.role === "admin")) {
    throw new Error("Unauthorized")
  }
  return { supabaseAdmin, userId }
}

export async function listReports(status?: string) {
  const { supabaseAdmin } = await requireAdmin()

  const { data: reports, error } = await supabaseAdmin
    .from("content_reports")
    .select("id, content_object_id, user_id, reason, status, created_at, target_type, target_id")
    .eq("status", status ?? "pending")
    .order("created_at", { ascending: false })
  if (error) {
    console.error("[server] Failed to list reports:", error)
    throw new Error("Request failed. Please try again.")
  }

  // Join reported pieces + author handles (admin client, two lookups + a map).
  const pieceIds = [...new Set((reports ?? []).map((r: { content_object_id: string | null }) => r.content_object_id).filter(Boolean))]
  const pieceMap = new Map<string, { title: string; slug: string | null; status: string; author_handle: string | null }>()
  if (pieceIds.length > 0) {
    const { data: pieces } = await supabaseAdmin
      .from("content_objects")
      .select("id, title, slug, status, author_id")
      .in("id", pieceIds)
    const authorIds = [...new Set((pieces ?? []).map((p: { author_id: string }) => p.author_id))]
    const { data: authors } = authorIds.length
      ? await supabaseAdmin.from("profiles").select("id, handle").in("id", authorIds)
      : { data: [] }
    const handleById = new Map((authors ?? []).map((a: { id: string; handle: string | null }) => [a.id, a.handle]))
    for (const p of pieces ?? []) {
      pieceMap.set(p.id, {
        title: p.title,
        slug: p.slug,
        status: p.status,
        author_handle: handleById.get(p.author_id) ?? null,
      })
    }
  }

  return (reports ?? []).map((r: { content_object_id: string | null }) => ({
    ...r,
    piece: r.content_object_id ? (pieceMap.get(r.content_object_id) ?? null) : null,
  }))
}

// ponytail: not transactional; wrap in an RPC if audit-row atomicity ever matters
export async function takedownContent({
  reportId,
  contentObjectId,
  action,
}: {
  reportId?: string
  contentObjectId: string
  action: "archived" | "deleted"
}) {
  const { supabaseAdmin, userId } = await requireAdmin()

  // For CSAM/illegal content, evidence MUST be preserved and reported per
  // docs/moderation-plan.md §2.B (IT Rules / POCSO duties) BEFORE hard-deleting —
  // complete the legal-hold step first; never silently delete.
  const { data: piece, error } = await supabaseAdmin
    .from("content_objects")
    .update({ status: action })
    .eq("id", contentObjectId)
    .select("author_id")
    .maybeSingle()
  if (error) {
    console.error("[server] Takedown failed:", error)
    return { success: false, error: "Failed to update content" }
  }

  // Idempotency for the strike: a report-driven takedown only strikes if THIS
  // report actually transitioned pending -> resolved. A piece can be taken down
  // twice (archive then delete); the second pass finds the report already
  // resolved (null row) and skips the strike. A direct takedown (no reportId) is
  // a single admin act and always strikes.
  let shouldStrike = true
  if (reportId) {
    const { data: resolved } = await supabaseAdmin
      .from("content_reports")
      .update({ status: "resolved" })
      .eq("id", reportId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle()
    if (!resolved) shouldStrike = false
  }

  const { error: auditError } = await supabaseAdmin.from("moderation_actions").insert({
    moderator_id: userId,
    content_object_id: contentObjectId,
    report_id: reportId ?? null,
    action: action === "archived" ? "takedown_archived" : "takedown_deleted",
  })
  if (auditError) console.error("[server] Failed to write audit row:", auditError)

  const authorId = (piece as { author_id?: string } | null)?.author_id
  if (shouldStrike && authorId) {
    await applyStrike(supabaseAdmin, {
      authorId,
      moderatorId: userId,
      contentObjectId,
      reportId: reportId ?? null,
    })
  }

  return { success: true }
}

export async function dismissReport({ reportId }: { reportId: string }) {
  const { supabaseAdmin, userId } = await requireAdmin()

  const { data: report, error } = await supabaseAdmin
    .from("content_reports")
    .update({ status: "dismissed" })
    .eq("id", reportId)
    .select("content_object_id")
    .single()
  if (error) {
    console.error("[server] Dismiss failed:", error)
    return { success: false, error: "Failed to dismiss report" }
  }

  const { error: auditError } = await supabaseAdmin.from("moderation_actions").insert({
    moderator_id: userId,
    content_object_id: report?.content_object_id ?? null,
    report_id: reportId,
    action: "dismissed",
  })
  if (auditError) console.error("[server] Failed to write audit row:", auditError)

  return { success: true }
}

// ---------- Restrictions & appeals (admin surface) ----------

export type PendingAppeal = {
  id: string
  user_id: string
  reason: string
  created_at: string | null
  handle: string | null
  strikes: number | null
  restricted_until: string | null
  restricted_reason: string | null
}

// Pending appeals for the admin to review, joined to the appellant's penalty state.
export async function listAppeals(): Promise<PendingAppeal[]> {
  const { supabaseAdmin } = await requireAdmin()

  const { data: appeals, error } = await supabaseAdmin
    .from("restriction_appeals")
    .select("id, user_id, reason, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
  if (error) {
    console.error("[server] listAppeals failed:", error)
    throw new Error("Request failed. Please try again.")
  }

  const ids = [...new Set((appeals ?? []).map((a: { user_id: string }) => a.user_id))]
  const byId = new Map<string, { handle: string | null; strikes: number | null; restricted_until: string | null; restricted_reason: string | null }>()
  if (ids.length) {
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, handle, strikes, restricted_until, restricted_reason")
      .in("id", ids)
    for (const p of profs ?? []) byId.set(p.id, p)
  }

  return (appeals ?? []).map((a: { id: string; user_id: string; reason: string; created_at: string | null }) => ({
    ...a,
    handle: byId.get(a.user_id)?.handle ?? null,
    strikes: byId.get(a.user_id)?.strikes ?? null,
    restricted_until: byId.get(a.user_id)?.restricted_until ?? null,
    restricted_reason: byId.get(a.user_id)?.restricted_reason ?? null,
  }))
}

// Decide an appeal. 'lift' clears the restriction (+ resets strikes) and reuses
// the same clearRestriction path as a manual lift; 'deny' leaves the restriction
// to run out its own timer. Gated so a double-submit can't re-decide.
export async function resolveAppeal(args: { data: { id: string; decision: "lift" | "deny" } }) {
  const { supabaseAdmin, userId } = await requireAdmin()
  const { id, decision } = args.data
  if (decision !== "lift" && decision !== "deny") throw new Error("Invalid decision")

  const { data: appeal } = await supabaseAdmin
    .from("restriction_appeals")
    .update({
      status: decision === "lift" ? "lifted" : "denied",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("user_id")
    .maybeSingle()
  if (!appeal) throw new Error("Appeal not found or already resolved.")

  if (decision === "lift") {
    await clearRestriction(supabaseAdmin, (appeal as { user_id: string }).user_id, userId)
  }
  return { success: true }
}

// Manual lift, independent of any appeal (admin acts directly on a user).
export async function liftRestriction(args: { data: { userId: string } }) {
  const { supabaseAdmin, userId } = await requireAdmin()
  await clearRestriction(supabaseAdmin, args.data.userId, userId)
  return { success: true }
}

export async function restoreContent({ contentObjectId }: { contentObjectId: string }) {
  const { supabaseAdmin, userId } = await requireAdmin()

  const { error } = await supabaseAdmin
    .from("content_objects")
    .update({ status: "published" })
    .eq("id", contentObjectId)
  if (error) {
    console.error("[server] Restore failed:", error)
    return { success: false, error: "Failed to restore content" }
  }

  const { error: auditError } = await supabaseAdmin.from("moderation_actions").insert({
    moderator_id: userId,
    content_object_id: contentObjectId,
    action: "restored",
  })
  if (auditError) console.error("[server] Failed to write audit row:", auditError)

  return { success: true }
}
