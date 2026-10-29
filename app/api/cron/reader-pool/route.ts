import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { settleReaderPools } from "@/lib/reader-pool"
import { alertOps } from "@/lib/alerts"

// Dynamic: runs queries + mutates on each invocation.
export const dynamic = "force-dynamic"

// Settle the reader-directed pool for the most recently completed calendar
// month. Idempotent (pool_settled_until claim), so a duplicate fire is a no-op.
export async function GET(request: Request) {
  // Fail closed: an unset CRON_SECRET must not leave a money route public.
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 })
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Last full calendar month in UTC: [first day of prev month, first of this].
  const now = new Date()
  const periodEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  )
  const periodStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
  )

  try {
    const supabaseAdmin = await createAdminClient()
    const result = await settleReaderPools(
      supabaseAdmin,
      periodStart.toISOString(),
      periodEnd.toISOString()
    )
    return NextResponse.json({
      success: true,
      period: { start: periodStart.toISOString(), end: periodEnd.toISOString() },
      ...result,
    })
  } catch (err) {
    console.error("[Cron ReaderPool] settlement failed:", err)
    await alertOps("[Cron ReaderPool] settlement run failed", {
      error: String(err),
      period: { start: periodStart.toISOString(), end: periodEnd.toISOString() },
    })
    return NextResponse.json({ error: "Settlement failed" }, { status: 500 })
  }
}
