import { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { verifyRazorpaySignature } from "@/lib/razorpay/verify"
import { markPayoutPaid, markPayoutFailed } from "@/actions/admin/payouts"
import { alertOps } from "@/lib/alerts"

type ServiceClient = Awaited<ReturnType<typeof createServiceRoleClient>>
type PayoutEntity = {
  id: string
  reference_id?: string
  status: string
  failure_reason?: string
}

// Reconcile a RazorpayX payout event onto the payout_requests row. Pure dispatch
// (no signature work) so it unit-tests directly. reference_id is the
// payout_requests.id set at disburse.
export async function handleRazorpayxEvent(
  svc: ServiceClient,
  event: string,
  entity: PayoutEntity
) {
  const id = entity.reference_id
  if (!id) {
    await alertOps(`razorpayx ${event} without reference_id`, { event })
    return
  }
  if (event === "payout.processed") {
    await markPayoutPaid(svc, id, entity.id)
  } else if (event === "payout.failed" || event === "payout.reversed") {
    const res = await markPayoutFailed(svc, id, entity.failure_reason ?? event)
    // A reversal that can't transition (gated) means the row was already 'paid':
    // money left and came back, so it needs a manual clawback, not a silent pass.
    if (!res.settled && event === "payout.reversed")
      await alertOps(
        `razorpayx payout.reversed on already-settled payout ${id} — manual clawback`,
        { id }
      )
  }
  // other events ignored
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-razorpay-signature")
  const body = await request.text()
  const secret = process.env.RAZORPAYX_WEBHOOK_SECRET
  if (!secret) return new Response("Webhook not configured", { status: 500 })
  if (!signature) return new Response("Missing signature", { status: 401 })
  if (!verifyRazorpaySignature(body, signature, secret))
    return new Response("Invalid signature", { status: 401 })

  let payload: { event: string; payload: { payout?: { entity: PayoutEntity } } }
  try {
    payload = JSON.parse(body)
  } catch {
    return new Response("Bad JSON", { status: 400 })
  }

  const entity = payload.payload?.payout?.entity
  if (!entity) return new Response("ok", { status: 200 })
  try {
    const svc = await createServiceRoleClient()
    await handleRazorpayxEvent(svc, payload.event, entity)
  } catch (e) {
    console.error("razorpayx webhook handler error", e)
    await alertOps(`razorpayx webhook handler error for ${payload.event}`, {
      error: String(e),
    })
    return new Response("Handler error", { status: 500 })
  }
  return new Response("ok", { status: 200 })
}
