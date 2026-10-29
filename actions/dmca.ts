/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"

import { SITE_URL } from "@/lib/brand"
import { createServiceRoleClient, createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit.server"
import { validateNotice, type NoticeInput } from "@/lib/dmca/validate"
import { requireAdmin } from "@/actions/moderation"
import { applyStrike } from "@/lib/restrictions"
import { sendEmail } from "@/lib/email"
import { authorDisabledEmail, complainantCounterEmail } from "@/lib/dmca/emails"
import {
  validateCounterNotice,
  restoreEligibleAt,
  type CounterNoticeInput,
} from "@/lib/dmca/validate"

// Public: a rightsholder (usually not a signed-in user) files a copyright notice
// or an India grievance. This NEVER disables content — it queues for an admin.
// ponytail: rate-limited by complainant email only (no request IP in a server
// action); honeypot + admin-gated disable cover the rest. Add IP limiting via a
// route handler only if email-rotation flooding becomes real.
export async function fileDmcaNotice(input: NoticeInput & { website?: string }) {
  // Honeypot: a hidden field real users never fill. Pretend success for bots.
  if (input.website && input.website.trim()) return { success: true, reference: null }

  const v = validateNotice(input)
  if (!v.ok) return { success: false, errors: v.errors }

  const email = input.complainant_email.trim().toLowerCase()
  const rl = await checkRateLimit("dmca_notice", email, 5, 86400)
  if (!rl.ok) return { success: false, error: "Too many notices filed. Please try again later." }

  const svc = await createServiceRoleClient()

  // External rightsholders know the URL, not the internal id. Prefer a supplied
  // id; otherwise resolve from the infringing URL's slug. An unresolvable URL
  // still captures the notice (null target) for admin triage — never reject a
  // valid §512 notice just because we couldn't auto-match the piece.
  const target =
    (input.target_content_object_id ?? "").trim() || (await resolvePieceId(svc, input.infringing_urls))

  const { data, error } = await svc
    .from("dmca_notices")
    .insert({
      notice_type: input.notice_type,
      target_content_object_id: target,
      complainant_name: input.complainant_name.trim(),
      complainant_email: email,
      complainant_address: input.complainant_address.trim(),
      complainant_role: input.complainant_role,
      work_identification: input.work_identification.trim(),
      infringing_urls: input.infringing_urls.map((u) => u.trim()).filter(Boolean),
      good_faith_statement: input.good_faith_statement,
      accuracy_statement: input.accuracy_statement,
      signature: input.signature.trim(),
      status: "received",
    })
    .select("id")
    .single()

  if (error) {
    console.error("[server] fileDmcaNotice failed:", error)
    return { success: false, error: "Could not file your notice. Please try again." }
  }
  return { success: true, reference: data.id as string }
}

// Base URL for links in emails. NEXT_PUBLIC_SITE_URL is already used elsewhere;
// fall back to the production host.
function siteUrl() {
  return SITE_URL
}

// Resolve a content object from an infringing URL by its slug (last path
// segment of /u/{handle}/{slug}). Returns the first match, or null.
// ponytail: slug lookup only — a renamed slug or an ambiguous match falls
// through to null and admin triage, which is the intended fallback.
async function resolvePieceId(svc: any, urls: string[]): Promise<string | null> {
  for (const raw of urls) {
    let slug: string | null = null
    try {
      slug = new URL(raw.trim()).pathname.split("/").filter(Boolean).pop() ?? null
    } catch {
      slug = raw.trim().split("/").filter(Boolean).pop() ?? null
    }
    if (!slug) continue
    const { data } = await svc.from("content_objects").select("id").eq("slug", slug).maybeSingle()
    if (data?.id) return data.id as string
  }
  return null
}

export async function listDmcaNotices(status?: string) {
  const { supabaseAdmin } = await requireAdmin()
  const { data: notices, error } = await supabaseAdmin
    .from("dmca_notices")
    .select(
      "id, notice_type, status, created_at, complainant_name, complainant_email, work_identification, infringing_urls, target_content_object_id"
    )
    .eq("status", status ?? "received")
    .order("created_at", { ascending: true })
  if (error) {
    console.error("[server] listDmcaNotices failed:", error)
    throw new Error("Request failed. Please try again.")
  }
  const pieceIds = [
    ...new Set((notices ?? []).map((n: any) => n.target_content_object_id).filter(Boolean)),
  ]
  const pieceMap = new Map<
    string,
    { title: string; slug: string | null; status: string; author_handle: string | null }
  >()
  if (pieceIds.length) {
    const { data: pieces } = await supabaseAdmin
      .from("content_objects")
      .select("id, title, slug, status, author_id")
      .in("id", pieceIds)
    const authorIds = [...new Set((pieces ?? []).map((p: any) => p.author_id))]
    const { data: authors } = authorIds.length
      ? await supabaseAdmin.from("profiles").select("id, handle").in("id", authorIds)
      : { data: [] as any[] }
    const handleById = new Map((authors ?? []).map((a: any) => [a.id, a.handle]))
    for (const p of pieces ?? [])
      pieceMap.set(p.id, {
        title: p.title,
        slug: p.slug,
        status: p.status,
        author_handle: handleById.get(p.author_id) ?? null,
      })
  }
  return (notices ?? []).map((n: any) => ({
    ...n,
    piece: pieceMap.get(n.target_content_object_id) ?? null,
  }))
}

export async function listDmcaCounterNotices() {
  const { supabaseAdmin } = await requireAdmin()
  const { data: counters, error } = await supabaseAdmin
    .from("dmca_counter_notices")
    .select("id, notice_id, status, restore_eligible_at, created_at, statement")
    .in("status", ["received", "forwarded"])
    .order("restore_eligible_at", { ascending: true })
  if (error) {
    console.error("[server] listDmcaCounterNotices failed:", error)
    throw new Error("Request failed. Please try again.")
  }
  const noticeIds = [...new Set((counters ?? []).map((c: any) => c.notice_id))]
  const titleByNotice = new Map<string, string | null>()
  if (noticeIds.length) {
    const { data: notices } = await supabaseAdmin
      .from("dmca_notices")
      .select("id, target_content_object_id")
      .in("id", noticeIds)
    const pieceIds = [...new Set((notices ?? []).map((n: any) => n.target_content_object_id))]
    const { data: pieces } = pieceIds.length
      ? await supabaseAdmin.from("content_objects").select("id, title").in("id", pieceIds)
      : { data: [] as any[] }
    const titleById = new Map((pieces ?? []).map((p: any) => [p.id, p.title]))
    for (const n of notices ?? [])
      titleByNotice.set(n.id, titleById.get(n.target_content_object_id) ?? null)
  }
  return (counters ?? []).map((c: any) => ({
    ...c,
    piece_title: titleByNotice.get(c.notice_id) ?? null,
  }))
}

// ponytail: not transactional, matching takedownContent. Wrap in an RPC only if
// audit/email atomicity ever matters.
export async function actionDmcaNotice(args: {
  id: string
  decision: "disable" | "reject"
  note?: string
}) {
  const { supabaseAdmin, userId } = await requireAdmin()
  const { id, decision, note } = args

  const { data: notice } = await supabaseAdmin
    .from("dmca_notices")
    .select("id, status, target_content_object_id, complainant_email")
    .eq("id", id)
    .maybeSingle()
  if (!notice) return { success: false, error: "Notice not found." }
  if ((notice as any).status !== "received")
    return { success: false, error: "This notice was already actioned." }

  const now = new Date().toISOString()

  if (decision === "reject") {
    await supabaseAdmin
      .from("dmca_notices")
      .update({ status: "rejected", admin_note: note ?? null, actioned_by: userId, actioned_at: now })
      .eq("id", id)
    return { success: true }
  }

  // disable: archive the piece (reversible), audit, mark actioned, strike, notify.
  const targetId = (notice as any).target_content_object_id
  const { data: piece } = await supabaseAdmin
    .from("content_objects")
    .select("author_id, title, slug, status")
    .eq("id", targetId)
    .maybeSingle()
  if (!piece) return { success: false, error: "The reported content no longer exists." }

  // A prior notice may have already archived this piece. Re-archiving is a
  // no-op; the point is to NOT stack a second strike or re-email the author.
  const alreadyDown = (piece as any).status === "archived"
  if (!alreadyDown) {
    await supabaseAdmin.from("content_objects").update({ status: "archived" }).eq("id", targetId)
  }

  await supabaseAdmin.from("moderation_actions").insert({
    moderator_id: userId,
    content_object_id: targetId,
    action: "dmca_disable",
  })
  await supabaseAdmin
    .from("dmca_notices")
    .update({ status: "actioned", admin_note: note ?? null, actioned_by: userId, actioned_at: now })
    .eq("id", id)

  const authorId = (piece as any).author_id
  if (authorId && !alreadyDown) {
    await applyStrike(supabaseAdmin, {
      authorId,
      moderatorId: userId,
      contentObjectId: (notice as any).target_content_object_id,
      reason: "dmca",
    })
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(authorId)
    const email = authUser?.user?.email
    if (email) {
      const mail = authorDisabledEmail({
        pieceTitle: (piece as any)?.title ?? "your piece",
        counterUrl: `${siteUrl()}/dmca/counter/${id}`,
      })
      await sendEmail(email, mail.subject, mail.html, undefined, mail.layout)
    }
  }
  return { success: true }
}

// Undo a mis-reject: send a rejected notice back to the received queue so an
// admin can re-triage it.
export async function reopenDmcaNotice(args: { id: string }) {
  const { supabaseAdmin } = await requireAdmin()
  const { data: notice } = await supabaseAdmin
    .from("dmca_notices")
    .select("status")
    .eq("id", args.id)
    .maybeSingle()
  if (!notice) return { success: false, error: "Notice not found." }
  if ((notice as any).status !== "rejected")
    return { success: false, error: "Only a rejected notice can be reopened." }
  await supabaseAdmin
    .from("dmca_notices")
    .update({ status: "received", admin_note: null, actioned_by: null, actioned_at: null })
    .eq("id", args.id)
  return { success: true }
}

// Match an unmatched notice (filed by URL, piece not auto-resolved) to a piece
// by its URL, so it becomes actionable in-app instead of needing raw DB access.
export async function resolveNoticeTarget(args: { id: string; url: string }) {
  const { supabaseAdmin } = await requireAdmin()
  const pieceId = await resolvePieceId(supabaseAdmin, [args.url])
  if (!pieceId) return { success: false, error: "No piece matches that URL." }
  await supabaseAdmin
    .from("dmca_notices")
    .update({ target_content_object_id: pieceId })
    .eq("id", args.id)
  return { success: true, pieceId }
}

export async function restoreFromCounterNotice(args: { counterNoticeId: string }) {
  const { supabaseAdmin, userId } = await requireAdmin()
  const { data: cn } = await supabaseAdmin
    .from("dmca_counter_notices")
    .select("id, notice_id, status, restore_eligible_at")
    .eq("id", args.counterNoticeId)
    .maybeSingle()
  if (!cn) return { success: false, error: "Counter-notice not found." }
  if ((cn as any).status === "restored") return { success: true }
  if (new Date() < new Date((cn as any).restore_eligible_at))
    return { success: false, error: "Not yet eligible to restore." }

  const { data: notice } = await supabaseAdmin
    .from("dmca_notices")
    .select("target_content_object_id")
    .eq("id", (cn as any).notice_id)
    .maybeSingle()
  if (!notice) return { success: false, error: "Linked notice is missing." }

  // Only republish if the piece is STILL archived by the DMCA disable. If it was
  // independently removed (e.g. hard-removed for an unrelated reason) or the
  // author moved it meanwhile, restoring would resurrect content taken down for
  // a different, possibly legally-mandated reason. Refuse instead.
  const targetId = (notice as any).target_content_object_id
  const { data: piece } = await supabaseAdmin
    .from("content_objects")
    .select("status")
    .eq("id", targetId)
    .maybeSingle()
  if (!piece) return { success: false, error: "The content no longer exists." }
  if ((piece as any).status !== "archived")
    return {
      success: false,
      error: "This content is no longer under the copyright hold and can't be restored here.",
    }

  await supabaseAdmin.from("content_objects").update({ status: "published" }).eq("id", targetId)
  await supabaseAdmin.from("moderation_actions").insert({
    moderator_id: userId,
    content_object_id: targetId,
    action: "dmca_restore",
  })
  await supabaseAdmin
    .from("dmca_counter_notices")
    .update({ status: "restored", restored_at: new Date().toISOString() })
    .eq("id", args.counterNoticeId)
  return { success: true }
}

export async function fileCounterNotice(input: CounterNoticeInput) {
  const { data: a } = await (await createClient()).auth.getUser()
  const userId = a?.user?.id
  if (!userId) return { success: false, error: "Sign in to file a counter-notice." }

  const v = validateCounterNotice(input)
  if (!v.ok) return { success: false, errors: v.errors }

  const svc = await createServiceRoleClient()
  const { data: notice } = await svc
    .from("dmca_notices")
    .select("id, status, target_content_object_id, complainant_email")
    .eq("id", input.notice_id)
    .maybeSingle()
  if (!notice || (notice as any).status !== "actioned")
    return { success: false, error: "There is no active claim to counter." }

  const { data: piece } = await svc
    .from("content_objects")
    .select("author_id, title, status")
    .eq("id", (notice as any).target_content_object_id)
    .maybeSingle()
  if (!piece || (piece as any).author_id !== userId)
    return { success: false, error: "That is not your content." }

  // One counter-notice per notice.
  const { data: existing } = await svc
    .from("dmca_counter_notices")
    .select("id")
    .eq("notice_id", input.notice_id)
    .maybeSingle()
  if (existing) return { success: true }

  const { error } = await svc.from("dmca_counter_notices").insert({
    notice_id: input.notice_id,
    author_id: userId,
    statement: input.statement.trim(),
    consent_jurisdiction: input.consent_jurisdiction,
    good_faith: input.good_faith,
    signature: input.signature.trim(),
    contact: input.contact.trim(),
    restore_eligible_at: restoreEligibleAt(new Date()),
    status: "received",
  })
  if (error) {
    // 23505 = unique_violation on notice_id: a concurrent submit already created
    // the one allowed counter-notice. Idempotent success — the winning request
    // forwards to the complainant; don't error the loser or forward twice.
    if ((error as any).code === "23505") return { success: true }
    console.error("[server] fileCounterNotice failed:", error)
    return { success: false, error: "Could not file your counter-notice. Please try again." }
  }

  // §512(g)(2): forward the counter-notice to the complainant.
  const complainantEmail = (notice as any).complainant_email
  if (complainantEmail) {
    const mail = complainantCounterEmail({
      pieceTitle: (piece as any).title ?? "the content",
      statement: input.statement.trim(),
      contact: input.contact.trim(),
    })
    await sendEmail(complainantEmail, mail.subject, mail.html, undefined, mail.layout)
    await svc
      .from("dmca_counter_notices")
      .update({ status: "forwarded" })
      .eq("notice_id", input.notice_id)
  }
  return { success: true }
}
