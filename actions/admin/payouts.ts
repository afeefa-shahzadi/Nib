"use server"

import { NIB_EMAIL, escapeHtml, nibButton } from "@/lib/email-layout"
import { SITE_URL } from "@/lib/brand"
import { createServiceRoleClient, createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email"
import { decryptSecret } from "@/lib/crypto"
import {
  razorpayxConfigured,
  createContact,
  createFundAccount,
  createPayout,
  payoutModeFor,
} from "@/lib/razorpayx/client"
import {
  tdsOnPayoutPaise,
  payoutNetPaise,
  PAYOUT_FEE_PAISE,
  gstFromInclusiveFeePaise,
  indianFyQuarter,
  fyQuarterBounds,
} from "@/lib/tax"

type ServiceClient = Awaited<ReturnType<typeof createServiceRoleClient>>

// ponytail: requireAdmin is duplicated from actions/moderation.ts. Extract to a
// shared lib only when a third admin domain needs it — two copies of a ~15-line
// guard isn't worth a refactor yet.
// Identity comes from the cookie-aware client; the role check and all admin work
// run on the service-role client (RLS/grants would empty the payout queue).
async function requireAdmin() {
  const { data: authData } = await (await createClient()).auth.getUser()
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

export type PendingPayout = {
  id: string
  user_id: string | null
  amount_paise: number | null
  destination: string | null
  status: string
  created_at: string | null
  handle: string | null
}

// Open payouts (requested / processing) for the admin to pay out-of-band.
export async function listPendingPayouts(): Promise<PendingPayout[]> {
  const { supabaseAdmin } = await requireAdmin()

  const { data: rows, error } = await supabaseAdmin
    .from("payout_requests")
    .select("id, user_id, amount_paise, destination, status, created_at")
    .in("status", ["requested", "processing"])
    .order("created_at", { ascending: true })
  if (error) {
    console.error("[server] listPendingPayouts failed:", error)
    throw new Error("Request failed. Please try again.")
  }

  const userIds = [
    ...new Set((rows ?? []).map((r) => r.user_id).filter(Boolean)),
  ] as string[]
  const handleById = new Map<string, string | null>()
  if (userIds.length) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, handle")
      .in("id", userIds)
    for (const p of profiles ?? []) handleById.set(p.id, p.handle)
  }

  return (rows ?? []).map((r) => ({
    ...r,
    handle: r.user_id ? (handleById.get(r.user_id) ?? null) : null,
  }))
}

const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN")}`

// Best-effort creator notification. Never block or fail settlement on email.
async function notifyPayout(
  svc: ServiceClient,
  userId: string | null,
  subject: string,
  html: string,
  tone: "success" | "warning" = "success"
) {
  try {
    if (!userId) return
    const { data: u } = await svc.auth.admin.getUserById(userId)
    const email = u?.user?.email
    if (email) await sendEmail(email, subject, html, undefined, { eyebrow: "Payout", tone })
  } catch (e) {
    console.error("[server] payout notify failed (non-blocking):", e)
  }
}

// Gated processing/requested -> paid. Records 1% TDS (Sec 194-O, idempotent via
// the unique payout_id index) and emails the creator the net. Idempotent: only
// an open row transitions, so a webhook retry or a manual double-settle is a
// no-op. `reference` is the RazorpayX payout id (automated) or UTR (manual).
// Shared by settlePayout and the RazorpayX payout webhook so both drive the
// same state machine.
export async function markPayoutPaid(
  svc: ServiceClient,
  id: string,
  reference: string,
  processedBy: string | null = null
): Promise<{ settled: boolean }> {
  const patch: Record<string, unknown> = {
    status: "paid",
    reference: reference.trim(),
    failure_reason: null,
    processed_at: new Date().toISOString(),
  }
  // Only stamp processed_by when we have one (manual settle). The webhook passes
  // null and must not erase the admin recorded at disburse time.
  if (processedBy) patch.processed_by = processedBy
  const { data: row } = await svc
    .from("payout_requests")
    .update(patch)
    .eq("id", id)
    .in("status", ["requested", "processing"])
    .select("user_id, amount_paise")
    .maybeSingle()
  if (!row) return { settled: false }

  const gross = row.amount_paise ?? 0
  const tds = tdsOnPayoutPaise(gross)
  const netToCreator = payoutNetPaise(gross)
  if (tds > 0) {
    const { error: tdsErr } = await svc.from("tds_withholdings").insert({
      user_id: row.user_id,
      payout_id: id,
      gross_paise: gross,
      tds_paise: tds,
      net_paise: gross - tds,
      quarter: indianFyQuarter(new Date()),
    })
    if (tdsErr && tdsErr.code !== "23505")
      console.error("[server] TDS record failed (payout already settled):", tdsErr)
  }

  await notifyPayout(
    svc,
    row.user_id as string | null,
    `Your ${inr(netToCreator)} payout is on its way`,
    `<h1>Your payout is on its way</h1>` +
      `<p style="font-family:${NIB_EMAIL.serif};font-size:34px;line-height:1.1;margin:4px 0 18px;color:${NIB_EMAIL.success}">${inr(netToCreator)}</p>` +
      `<div class="nib-note">${inr(gross)} gross, less <strong>${inr(tds)}</strong> withheld as 1% TDS (Sec 194-O) and ${inr(PAYOUT_FEE_PAISE)} bank transfer fee. Claim the TDS as a credit in your return.</div>` +
      `<p style="margin-top:16px;font-size:13px;color:${NIB_EMAIL.muted}">Reference: ${escapeHtml(reference.trim())}</p>` +
      nibButton("View earnings", `${SITE_URL}/studio/earnings`, "success")
  )
  return { settled: true }
}

// Gated processing/requested -> failed. The reserved funds return to the
// creator's available balance automatically (computeWithdrawableBalancePaise
// excludes failed rows). Idempotent, like markPayoutPaid.
export async function markPayoutFailed(
  svc: ServiceClient,
  id: string,
  reason: string | null,
  processedBy: string | null = null
): Promise<{ settled: boolean }> {
  const patch: Record<string, unknown> = {
    status: "failed",
    failure_reason: reason?.trim() || null,
    // Clear the reference (manual settle's long-standing behaviour). On the
    // automated path this drops the RazorpayX payout id from the row; it stays
    // recoverable from RazorpayX via reference_id = the request id.
    reference: null,
    processed_at: new Date().toISOString(),
  }
  if (processedBy) patch.processed_by = processedBy
  const { data: row } = await svc
    .from("payout_requests")
    .update(patch)
    .eq("id", id)
    .in("status", ["requested", "processing"])
    .select("user_id, amount_paise")
    .maybeSingle()
  if (!row) return { settled: false }

  const gross = row.amount_paise ?? 0
  await notifyPayout(
    svc,
    row.user_id as string | null,
    `Your ${inr(gross)} payout couldn't be processed`,
    `<h1>We couldn't process your payout</h1>` +
      `<p>Your payout of <strong>${inr(gross)}</strong> didn't go through. The full amount is back in your available balance.</p>` +
      (reason?.trim() ? `<div class="nib-note">Reason: ${escapeHtml(reason.trim())}</div>` : "") +
      nibButton("Check payout details", `${SITE_URL}/studio/earnings`, "warning"),
    "warning"
  )
  return { settled: true }
}

// Record the outcome of a manual payout (out-of-band disbursement). This and the
// webhook both route through markPayoutPaid/markPayoutFailed, so the manual path
// stays the permanent fallback when RazorpayX is unconfigured or a payout fails.
export async function settlePayout(args: {
  data: {
    id: string
    status: "paid" | "failed"
    reference?: string
    failureReason?: string
  }
}) {
  const { supabaseAdmin, userId } = await requireAdmin()
  const { id, status, reference, failureReason } = args.data
  if (status !== "paid" && status !== "failed")
    throw new Error("Invalid status")
  if (status === "paid" && !reference?.trim())
    throw new Error("A payment reference (UTR / txn id) is required to mark a payout paid.")

  const res =
    status === "paid"
      ? await markPayoutPaid(supabaseAdmin, id, reference!.trim(), userId)
      : await markPayoutFailed(supabaseAdmin, id, failureReason ?? null, userId)
  if (!res.settled) throw new Error("Payout not found or already settled.")
  return { success: true }
}

// Admin approves a payout and the system disburses it via RazorpayX. Lazily
// provisions the RazorpayX contact + fund_account (ids cached on the method so a
// retry never double-creates), then POSTs /v1/payouts with an idempotency key =
// the payout_request id. The row moves requested -> processing; the webhook
// finishes it (paid/failed), where TDS + email happen. Gated on RAZORPAYX_*: when
// unconfigured, the admin uses settlePayout (manual) instead.
export async function disbursePayout(args: { data: { id: string } }) {
  const { supabaseAdmin, userId } = await requireAdmin()
  if (!razorpayxConfigured())
    return {
      success: false,
      error: "RazorpayX is not configured. Settle this payout manually.",
    }

  const { data: req } = await supabaseAdmin
    .from("payout_requests")
    .select("id, user_id, amount_paise, status, payout_method_id")
    .eq("id", args.data.id)
    .maybeSingle()
  if (!req || req.status !== "requested")
    return { success: false, error: "Payout is not awaiting disbursement." }
  if (!req.payout_method_id)
    return {
      success: false,
      error: "This payout has no structured method; settle it manually.",
    }

  const { data: m } = await supabaseAdmin
    .from("payout_methods")
    .select(
      "id, method_type, account_name, account_number, ifsc, vpa, pan, razorpayx_contact_id, razorpayx_fund_account_id"
    )
    .eq("id", req.payout_method_id)
    .maybeSingle()
  if (!m) return { success: false, error: "Payout method not found." }

  try {
    let contactId = m.razorpayx_contact_id as string | null
    let fundAccountId = m.razorpayx_fund_account_id as string | null
    if (!contactId) {
      const c = await createContact({
        name: m.account_name || "Creator",
        referenceId: m.id,
      })
      contactId = c.id
      await supabaseAdmin
        .from("payout_methods")
        .update({ razorpayx_contact_id: contactId })
        .eq("id", m.id)
    }
    if (!fundAccountId) {
      const fa = await createFundAccount({
        contactId: contactId!,
        methodType: m.method_type,
        bank:
          m.method_type === "bank_account"
            ? {
                name: m.account_name!,
                ifsc: m.ifsc!,
                accountNumber: decryptSecret(m.account_number!),
              }
            : undefined,
        vpa: m.method_type === "vpa" ? m.vpa! : undefined,
      })
      fundAccountId = fa.id
      await supabaseAdmin
        .from("payout_methods")
        .update({ razorpayx_fund_account_id: fundAccountId })
        .eq("id", m.id)
    }

    // Disburse the NET: the creator's balance drops by the full gross, the
    // platform withholds 1% TDS (recorded + remitted at the paid transition in
    // markPayoutPaid), and the creator's bank receives gross - TDS — the same
    // net the manual path pays by hand and the "payout on its way" email states.
    const gross = req.amount_paise ?? 0
    const netPaise = payoutNetPaise(gross)
    const pout = await createPayout({
      fundAccountId: fundAccountId!,
      amountPaise: netPaise,
      idempotencyKey: req.id,
      mode: payoutModeFor(m.method_type),
      referenceId: req.id,
    })

    const { data: upd } = await supabaseAdmin
      .from("payout_requests")
      .update({
        status: "processing",
        reference: pout.id,
        processed_by: userId,
        processed_at: new Date().toISOString(),
      })
      .eq("id", req.id)
      .in("status", ["requested"])
      .select("id")
      .maybeSingle()
    if (!upd) return { success: false, error: "Payout already being processed." }
    return { success: true }
  } catch (e) {
    // Row stays 'requested', reserve still held; admin retries (idempotency key
    // prevents a double payout) or settles manually.
    console.error("[server] disbursePayout:", e)
    return { success: false, error: (e as Error).message }
  }
}

// Guard D — GST/TDS liability report for the CA. Read-only: sums the platform
// fee taken over a period, the GST contained in it (fee treated as inclusive),
// and the TDS withheld. Defaults to the current Indian FY quarter.
//
// ponytail: fee is derived as gross-net on earnings_ledger + tips, which
// captures purchase/sponsorship/tip fees. The Reader-Pass pool's 15% cut is
// taken at the budget level and never lands as a gross/net pair in the ledger,
// so it is NOT in this figure — noted so the CA adds it from pool volume.
export async function getTaxSummary(args?: {
  data?: { fromISO?: string; toISO?: string }
}) {
  const { supabaseAdmin } = await requireAdmin()
  const bounds = fyQuarterBounds(new Date())
  const fromISO = args?.data?.fromISO ?? bounds.startISO
  const toISO = args?.data?.toISO ?? bounds.endISO

  const [{ data: ledger }, { data: tips }, { data: tds }] = await Promise.all([
    supabaseAdmin
      .from("earnings_ledger")
      .select("gross_paise, net_paise")
      .gte("created_at", fromISO)
      .lt("created_at", toISO),
    supabaseAdmin
      .from("tips")
      .select("amount_paise, net_paise")
      .eq("status", "paid")
      .gte("created_at", fromISO)
      .lt("created_at", toISO),
    supabaseAdmin
      .from("tds_withholdings")
      .select("tds_paise")
      .gte("created_at", fromISO)
      .lt("created_at", toISO),
  ])

  // Fee = gross - net, only where positive (skips the studio_credit debit and
  // chargeback reversal rows, whose gross==net==negative give a 0 fee anyway).
  let feePaise = 0
  for (const r of (ledger ?? []) as { gross_paise: number; net_paise: number }[])
    feePaise += Math.max(0, r.gross_paise - r.net_paise)
  for (const t of (tips ?? []) as { amount_paise: number; net_paise: number }[])
    feePaise += Math.max(0, t.amount_paise - t.net_paise)

  const tdsWithheldPaise = ((tds ?? []) as { tds_paise: number }[]).reduce(
    (s, r) => s + r.tds_paise,
    0
  )

  return {
    fromISO,
    toISO,
    quarter: indianFyQuarter(new Date(fromISO)),
    feePaise,
    gstOnFeePaise: gstFromInclusiveFeePaise(feePaise),
    tdsWithheldPaise,
  }
}
