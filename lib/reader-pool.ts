/* eslint-disable @typescript-eslint/no-explicit-any */
// Reader-pool settlement math + cron entry point. Lives OUTSIDE "use server":
// a "use server" module may only export async server actions (any other export
// makes the bundler drop the module's exports entirely), and settlement must
// not be a client-invokable action anyway — only the cron route calls it.
import { SupabaseClient } from "@supabase/supabase-js"
import { alertOps } from "@/lib/alerts"

// Reader Pass is ₹199/mo. Platform keeps 15%; the remaining 85% becomes the
// reader's monthly pool budget, split among the creators they clapped for.
// Config constants so the split can be tuned without a migration.
const READER_PRICE_PAISE = 19_900
export const PLATFORM_POOL_CUT = 0.15
export const POOL_BUDGET_PAISE = Math.floor(
  READER_PRICE_PAISE * (1 - PLATFORM_POOL_CUT)
) // 16_915

/**
 * Split `budget` paise across creators proportional to their weights.
 * Integer paise only; the last creator (stable sort order) absorbs the
 * rounding remainder so the full budget is always distributed, never leaked.
 * Returns [] when there is no positive weight (caller sends budget to platform).
 */
export function distributePool(
  budget: number,
  weights: { creatorId: string; weight: number }[]
): { creatorId: string; amount: number; weight: number }[] {
  const positive = weights.filter((w) => w.weight > 0)
  const total = positive.reduce((s, w) => s + w.weight, 0)
  if (total <= 0 || budget <= 0) return []

  // Stable order: heaviest first, id as tiebreak, so remainder assignment is
  // deterministic (important for the self-check and for reproducibility).
  const sorted = [...positive].sort(
    (a, b) => b.weight - a.weight || a.creatorId.localeCompare(b.creatorId)
  )

  const out: { creatorId: string; amount: number; weight: number }[] = []
  let assigned = 0
  for (let i = 0; i < sorted.length; i++) {
    const w = sorted[i]
    const amount =
      i === sorted.length - 1
        ? budget - assigned // last absorbs remainder
        : Math.floor((budget * w.weight) / total)
    assigned += amount
    out.push({ creatorId: w.creatorId, amount, weight: w.weight })
  }
  // Invariant: the full budget is distributed, never leaked or overpaid. Holds
  // by construction (last creator absorbs the remainder) — this makes it
  // load-bearing so a future refactor can't silently start leaking pool money.
  const sum = out.reduce((s, x) => s + x.amount, 0)
  if (sum !== budget)
    throw new Error(`pool split leak: distributed ${sum} !== budget ${budget}`)
  return out
}

/**
 * Settle the reader pool for one calendar month [periodStart, periodEnd).
 * Deterministic: takes explicit ISO bounds so it is testable and re-runnable.
 *
 * For every active Reader Pass whose budget for this month is unsettled:
 *  1. atomically claim the month by advancing pool_settled_until (a re-run or
 *     concurrent run claims zero rows and does nothing),
 *  2. weight creators by the reader's clap `count` that month (self-claps
 *     excluded; deleted pieces / null authors skipped),
 *  3. credit each creator's earnings_ledger (source='reader_pool') and write
 *     the transparency rows.
 *
 * ponytail: at-most-once on a mid-settlement crash — the claim advances before
 * the credit, so a crash after claim drops that reader's month (logged loudly,
 * not double-paid). Add a reversal/retry table only if this ever bites in prod.
 */
export async function settleReaderPools(
  supabaseAdmin: SupabaseClient,
  periodStart: string,
  periodEnd: string
): Promise<{
  settled: number
  readersWithNoClaps: number
  distributedPaise: number
}> {
  const { data: candidates, error } = await supabaseAdmin
    .from("reader_subscriptions")
    .select("id, user_id, pool_settled_until, created_at")
    .in("status", ["active", "authenticated"])
    .lt("created_at", periodEnd)
    .or(`pool_settled_until.is.null,pool_settled_until.lt.${periodEnd}`)

  if (error) {
    console.error("[reader-pool] candidate fetch failed", error)
    throw new Error("Reader pool settlement failed")
  }

  let settled = 0
  let readersWithNoClaps = 0
  let distributedPaise = 0

  for (const sub of candidates ?? []) {
    // 1. Atomic claim: only the caller that flips pool_settled_until forward
    // proceeds. Guards against double-runs and concurrent crons.
    const { data: claimed } = await supabaseAdmin
      .from("reader_subscriptions")
      .update({ pool_settled_until: periodEnd })
      .eq("id", sub.id)
      .or(`pool_settled_until.is.null,pool_settled_until.lt.${periodEnd}`)
      .select("id")
      .maybeSingle()
    if (!claimed) continue
    settled++

    // 2. Weight creators by this reader's claps in the window.
    const { data: claps } = await supabaseAdmin
      .from("piece_claps")
      .select("count, piece:content_objects(author_id, is_nsfw)")
      .eq("user_id", sub.user_id)
      .gte("created_at", periodStart)
      .lt("created_at", periodEnd)

    const weightByCreator = new Map<string, number>()
    for (const c of (claps ?? []) as any[]) {
      const authorId = c.piece?.author_id as string | undefined
      // Skip null + self, and NSFW pieces — Razorpay-funded pool money must not
      // flow to NSFW content (single-merchant freeze risk, see legal-payments-risk.md).
      if (!authorId || authorId === sub.user_id || c.piece?.is_nsfw) continue
      weightByCreator.set(
        authorId,
        (weightByCreator.get(authorId) ?? 0) + (c.count ?? 0)
      )
    }

    const splits = distributePool(
      POOL_BUDGET_PAISE,
      [...weightByCreator].map(([creatorId, weight]) => ({ creatorId, weight }))
    )

    if (splits.length === 0) {
      // No claps this month: budget stays with the platform. Reader still got
      // read-access value. Marker already advanced, so this won't re-run.
      readersWithNoClaps++
      continue
    }

    // 3. Credit creators + write the audit trail. Pool cut was already removed
    // at the budget level, so net == gross here.
    const ledgerRows = splits.map((s) => ({
      user_id: s.creatorId,
      source: "reader_pool",
      gross_paise: s.amount,
      net_paise: s.amount,
      status: "available",
    }))
    const distRows = splits.map((s) => ({
      reader_id: sub.user_id,
      creator_id: s.creatorId,
      period_end: periodEnd,
      amount_paise: s.amount,
      weight: s.weight,
    }))

    const { error: ledgerErr } = await supabaseAdmin
      .from("earnings_ledger")
      .insert(ledgerRows)
    if (ledgerErr) {
      // Loud: the month was claimed but credit failed. Manual reconcile needed.
      await alertOps(
        `[reader-pool] LEDGER CREDIT FAILED for reader ${sub.user_id} period ${periodEnd} — month claimed, manual reconcile needed`,
        { error: ledgerErr }
      )
      continue
    }
    await supabaseAdmin.from("reader_pool_distributions").insert(distRows)
    distributedPaise += splits.reduce((s, x) => s + x.amount, 0)
  }

  return { settled, readersWithNoClaps, distributedPaise }
}
