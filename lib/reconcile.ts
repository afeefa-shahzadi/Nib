// Payment reconciliation: diff Razorpay's captured payments (the truth) against
// local purchases + earnings_ledger, and ALERT on drift. Read-only by design —
// it never mutates or auto-credits (auto-crediting off a reconcile job is how
// one bug becomes a double-pay); a human reviews and replays the payment.
// Lives OUTSIDE "use server" for the same reason as lib/reader-pool.ts.
import { SupabaseClient } from "@supabase/supabase-js"
import { alertOps } from "@/lib/alerts"

export type CapturedPayment = {
  paymentId: string
  orderId: string
  amountPaise: number
}

export type LocalState = {
  /** purchases keyed by razorpay_order_id */
  purchasesByOrderId: Map<string, { status: string }>
  /** earnings_ledger row count keyed by razorpay payment id or order id */
  ledgerCountByPaymentOrOrder: Map<string, number>
}

export type Finding = CapturedPayment & {
  type: "MISSED_CREDIT" | "MISSING_LEDGER" | "DOUBLE_CREDIT"
}

/**
 * Pure diff of Razorpay truth vs local state.
 *  - MISSED_CREDIT: captured at Razorpay but purchase still 'created'/'pending'
 *    (webhook AND client confirm both missed — creator never credited).
 *  - MISSING_LEDGER: purchase settled but no earnings_ledger row.
 *  - DOUBLE_CREDIT: 2+ ledger rows for one payment — platform overpays.
 * Captured payments with no local purchase row are skipped: subscription
 * charges etc. also appear in /v1/payments and are not purchases.
 */
export function diffPayments(
  captured: CapturedPayment[],
  local: LocalState
): Finding[] {
  const findings: Finding[] = []
  for (const p of captured) {
    const purchase = local.purchasesByOrderId.get(p.orderId)
    if (!purchase) continue
    if (purchase.status === "created" || purchase.status === "pending") {
      findings.push({ type: "MISSED_CREDIT", ...p })
      continue
    }
    const ledgerCount =
      local.ledgerCountByPaymentOrOrder.get(p.paymentId) ??
      local.ledgerCountByPaymentOrOrder.get(p.orderId) ??
      0
    if (ledgerCount === 0) findings.push({ type: "MISSING_LEDGER", ...p })
    else if (ledgerCount >= 2) findings.push({ type: "DOUBLE_CREDIT", ...p })
  }
  return findings
}

// Same Basic-auth header as rzAuthHeader() in actions/payments.ts — replicated
// here because that file is "use server" and may only export async actions.
function rzAuthHeader() {
  const id = process.env.RAZORPAY_KEY_ID
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!id || !secret) throw new Error("Razorpay keys not configured")
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64")
}

async function fetchCapturedPayments(
  fromUnix: number,
  toUnix: number
): Promise<CapturedPayment[]> {
  const out: CapturedPayment[] = []
  for (let skip = 0; ; skip += 100) {
    const res = await fetch(
      `https://api.razorpay.com/v1/payments?from=${fromUnix}&to=${toUnix}&count=100&skip=${skip}`,
      { headers: { Authorization: rzAuthHeader() } }
    )
    if (!res.ok) {
      throw new Error(`Razorpay payments fetch failed: ${res.status}`)
    }
    const body = (await res.json()) as {
      items?: { id: string; order_id?: string; status: string; amount: number }[]
    }
    const items = body.items ?? []
    for (const p of items) {
      if (p.status === "captured" && p.order_id) {
        out.push({ paymentId: p.id, orderId: p.order_id, amountPaise: p.amount })
      }
    }
    if (items.length < 100) break
  }
  return out
}

type PurchaseRow = {
  razorpay_order_id: string
  status: string
  author_id: string | null
  amount_paise: number
  kind: string | null
  created_at: string
}

/**
 * Reconcile the [fromUnix, toUnix] window: fetch Razorpay captured payments,
 * load the matching local rows, diff, and alert once if anything drifted.
 * Silent when clean. Returns the summary for the cron response.
 */
export async function reconcileWindow(
  supabaseAdmin: SupabaseClient,
  fromUnix: number,
  toUnix: number
): Promise<{ checked: number; findings: Finding[] }> {
  const captured = await fetchCapturedPayments(fromUnix, toUnix)
  if (captured.length === 0) return { checked: 0, findings: [] }

  const { data: purchases, error } = await supabaseAdmin
    .from("purchases")
    .select("razorpay_order_id, status, author_id, amount_paise, kind, created_at")
    .in(
      "razorpay_order_id",
      captured.map((c) => c.orderId)
    )
  if (error) throw new Error(`purchases fetch failed: ${error.message}`)

  const purchasesByOrderId = new Map(
    ((purchases ?? []) as PurchaseRow[]).map((p) => [
      p.razorpay_order_id,
      { status: p.status },
    ])
  )

  // earnings_ledger has no payment/order column, so ledger rows are matched by
  // fingerprint (author, source, gross amount) within the window and dealt out
  // to paid purchases oldest-first; leftover rows pile onto the first purchase
  // so a surplus still surfaces as DOUBLE_CREDIT.
  // ponytail: approximate matching — same-author same-amount purchases in one
  // window can mis-attribute. Exact matching needs an order_id column on
  // earnings_ledger; add it if this ever pages falsely.
  const paid = ((purchases ?? []) as PurchaseRow[]).filter(
    (p) => p.status === "paid" && p.author_id
  )
  const ledgerCountByPaymentOrOrder = new Map<string, number>()
  if (paid.length > 0) {
    const { data: ledger, error: ledgerErr } = await supabaseAdmin
      .from("earnings_ledger")
      .select("user_id, source, gross_paise")
      .in("user_id", [...new Set(paid.map((p) => p.author_id as string))])
      .gte("created_at", new Date(fromUnix * 1000).toISOString())
    if (ledgerErr) throw new Error(`ledger fetch failed: ${ledgerErr.message}`)

    const rowsByKey = new Map<string, number>()
    for (const r of (ledger ?? []) as {
      user_id: string | null
      source: string | null
      gross_paise: number | null
    }[]) {
      const k = `${r.user_id}|${r.source}|${r.gross_paise}`
      rowsByKey.set(k, (rowsByKey.get(k) ?? 0) + 1)
    }

    const purchasesByKey = new Map<string, PurchaseRow[]>()
    for (const p of paid) {
      const k = `${p.author_id}|${p.kind ?? "purchase"}|${p.amount_paise}`
      purchasesByKey.set(k, [...(purchasesByKey.get(k) ?? []), p])
    }
    for (const [k, group] of purchasesByKey) {
      group.sort((a, b) => a.created_at.localeCompare(b.created_at))
      let rows = rowsByKey.get(k) ?? 0
      for (const p of group) {
        ledgerCountByPaymentOrOrder.set(p.razorpay_order_id, rows > 0 ? 1 : 0)
        if (rows > 0) rows--
      }
      if (rows > 0) {
        const first = group[0].razorpay_order_id
        ledgerCountByPaymentOrOrder.set(
          first,
          (ledgerCountByPaymentOrOrder.get(first) ?? 0) + rows
        )
      }
    }
  }

  const findings = diffPayments(captured, {
    purchasesByOrderId,
    ledgerCountByPaymentOrOrder,
  })
  if (findings.length > 0) {
    await alertOps(
      `[reconcile] ${findings.length} payment drift finding(s) — manual review needed (do NOT auto-credit)`,
      { findings }
    )
  }
  return { checked: captured.length, findings }
}
