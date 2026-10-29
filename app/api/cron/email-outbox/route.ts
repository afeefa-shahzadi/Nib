import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getTransporter } from "@/lib/email"
import { drainOutbox } from "@/lib/email-outbox"

export const dynamic = "force-dynamic"

// Hourly (pg_cron): send queued mail whose send_after has passed.
export async function GET(request: Request) {
  // Fail closed: an unset CRON_SECRET must not leave this route public.
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 })
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const transporter = await getTransporter()
  if (!transporter) {
    return NextResponse.json({ error: "Email not configured" }, { status: 500 })
  }

  try {
    const result = await drainOutbox(await createServiceRoleClient(), transporter)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error("[Cron Email Outbox] drain failed:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
