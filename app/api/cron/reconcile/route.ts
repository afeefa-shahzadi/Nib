import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { reconcileWindow } from "@/lib/reconcile"

// Dynamic: hits Razorpay + DB on each invocation.
export const dynamic = "force-dynamic"

// Daily payment reconciliation over a trailing 48h window (overlapping runs so
// nothing falls between them). Read-only: drift is alerted, never auto-fixed.
export async function GET(request: Request) {
  // Fail closed: an unset CRON_SECRET must not leave this route public.
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 })
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const toUnix = Math.floor(Date.now() / 1000)
  const fromUnix = toUnix - 48 * 3600

  try {
    const supabaseAdmin = await createAdminClient()
    const summary = await reconcileWindow(supabaseAdmin, fromUnix, toUnix)
    return NextResponse.json({
      success: true,
      window: { fromUnix, toUnix },
      ...summary,
    })
  } catch (err) {
    console.error("[Cron Reconcile] failed:", err)
    return NextResponse.json({ error: "Reconcile failed" }, { status: 500 })
  }
}
