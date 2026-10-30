import { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { verifyRazorpaySignature } from "@/lib/razorpay/verify"
import { alertOps } from "@/lib/alerts"

const READER_PASS_MONTHLY_IP = 2500

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-razorpay-signature")
  const body = await request.text()
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) return new Response("Webhook not configured", { status: 500 })
  if (!signature) return new Response("Missing signature", { status: 401 })

  if (!verifyRazorpaySignature(body, signature, secret)) {
    return new Response("Invalid signature", { status: 401 })
  }

  let payload: {
    event: string
    payload: {
      payment?: {
        entity: {
          id: string
          order_id?: string
          amount: number
          fee?: number | null
          status: string
          notes?: Record<string, string>
        }
      }
      subscription?: {
        entity: {
          id: string
          status: string
          current_end?: number
          notes?: Record<string, string>
        }
      }
    }
  }
  try {
    payload = JSON.parse(body)
  } catch {
    return new Response("Bad JSON", { status: 400 })
  }

  const event = payload.event
  const supabaseAdmin = await createAdminClient()

  try {
    if (event === "payment.captured" || event === "payment.failed") {
      const p = payload.payload.payment?.entity
      if (p?.order_id) {
        if (event === "payment.failed") {
          await supabaseAdmin
            .from("purchases")
            .update({ razorpay_payment_id: p.id, status: "failed" })
            .eq("razorpay_order_id", p.order_id)
            .eq("status", "created")
        } else {
          // Idempotent settlement: credits the creator's ledger and notifies
          // them exactly once, whether the client confirm or this webhook wins
          // the created->paid transition.
          const { settlePaidPurchase } =
            await import("@/actions/monetization/payments")
          await settlePaidPurchase(supabaseAdmin, p.order_id, p.id, p.fee)

          // Activate a boost if this order was for one (guarded so a webhook
          // retry can't re-stamp the boost window).
          const { data: boost } = await supabaseAdmin
            .from("boosts")
            .select("id, duration_hours")
            .eq("razorpay_order_id", p.order_id)
            .eq("status", "created")
            .maybeSingle()
          if (boost) {
            const starts = new Date()
            const ends = new Date(
              starts.getTime() + boost.duration_hours * 3600 * 1000
            )
            await supabaseAdmin
              .from("boosts")
              .update({
                razorpay_payment_id: p.id,
                status: "active",
                starts_at: starts.toISOString(),
                ends_at: ends.toISOString(),
              })
              .eq("id", boost.id)
              .eq("status", "created")
          }
        }
      }
    } else if (
      event === "refund.processed" ||
      event === "payment.dispute.created"
    ) {
      // Money went back to the buyer — claw the creator's credit back.
      // Razorpay includes the payment entity on refund and dispute events, so
      // the order id is right on the payload.
      const orderId = payload.payload.payment?.entity?.order_id
      if (orderId) {
        const { reversePaidPurchase } =
          await import("@/actions/monetization/payments")
        await reversePaidPurchase(supabaseAdmin, orderId)
      } else {
        await alertOps(
          `razorpay ${event} arrived without payment.order_id — reverse manually`,
          { event }
        )
      }
    } else if (event.startsWith("subscription.")) {
      const s = payload.payload.subscription?.entity
      if (s) {
        const statusMap: Record<string, string> = {
          "subscription.authenticated": "authenticated",
          "subscription.activated": "active",
          "subscription.charged": "active",
          "subscription.pending": "pending",
          "subscription.halted": "halted",
          "subscription.cancelled": "cancelled",
          "subscription.completed": "completed",
          "subscription.expired": "expired",
        }
        const newStatus = statusMap[event] ?? s.status
        const periodEnd = s.current_end
          ? new Date(s.current_end * 1000).toISOString()
          : null

        await supabaseAdmin
          .from("payment_subscriptions")
          .update({ status: newStatus, current_period_end: periodEnd })
          .eq("razorpay_subscription_id", s.id)

        const { syncMembershipFromSubscription } =
          await import("@/actions/monetization/payments")
        await syncMembershipFromSubscription(supabaseAdmin, s.id, newStatus)

        // Each successful membership charge pays the author (exactly once per
        // payment id). A no-op for Studio/Reader/Org subscriptions.
        const charge = payload.payload.payment?.entity
        if (event === "subscription.charged" && charge?.id) {
          const { settleMembershipCharge } =
            await import("@/actions/monetization/payments")
          await settleMembershipCharge(supabaseAdmin, s.id, charge)
        }

        const { data: studio } = await supabaseAdmin
          .from("studio_subscriptions")
          .update({ status: newStatus, current_period_end: periodEnd })
          .eq("razorpay_subscription_id", s.id)
          .select("user_id")
          .maybeSingle()
        if (studio?.user_id) {
          const isActive = ["active", "authenticated"].includes(newStatus)
          await supabaseAdmin
            .from("profiles")
            .update({ plan: isActive ? "studio" : "free" })
            .eq("id", studio.user_id)
        }

        const { data: reader } = await supabaseAdmin
          .from("reader_subscriptions")
          .update({ status: newStatus, current_period_end: periodEnd })
          .eq("razorpay_subscription_id", s.id)
          .select("user_id")
          .maybeSingle()
        if (reader?.user_id) {
          const isActive = ["active", "authenticated"].includes(newStatus)
          await supabaseAdmin
            .from("profiles")
            .update({ plan: isActive ? "reader" : "free" })
            .eq("id", reader.user_id)

          // Monthly IP grant: claim this billing period by advancing
          // ip_granted_until atomically — webhook retries and
          // activated+charged double-fires match zero rows and credit nothing.
          if (
            (event === "subscription.activated" ||
              event === "subscription.charged") &&
            periodEnd
          ) {
            const { data: claimed } = await supabaseAdmin
              .from("reader_subscriptions")
              .update({ ip_granted_until: periodEnd })
              .eq("razorpay_subscription_id", s.id)
              .or(`ip_granted_until.is.null,ip_granted_until.lt.${periodEnd}`)
              .select("user_id")
              .maybeSingle()
            if (claimed?.user_id) {
              const { data: prof } = await supabaseAdmin
                .from("profiles")
                .select("credits")
                .eq("id", claimed.user_id)
                .maybeSingle()
              await supabaseAdmin
                .from("profiles")
                .update({
                  credits: (prof?.credits ?? 0) + READER_PASS_MONTHLY_IP,
                })
                .eq("id", claimed.user_id)
            }
          }
        }

        const { data: org } = await supabaseAdmin
          .from("org_subscriptions")
          .update({ status: newStatus, current_period_end: periodEnd })
          .eq("razorpay_subscription_id", s.id)
          .select("org_id, seats")
          .maybeSingle()
        if (org?.org_id) {
          const isActive = ["active", "authenticated"].includes(newStatus)
          await supabaseAdmin
            .from("organizations")
            .update({ plan: isActive ? "team" : "trial", seats: org.seats })
            .eq("id", org.org_id)
        }
      }
    }
  } catch (e) {
    console.error("razorpay webhook handler error", e)
    await alertOps(`razorpay webhook handler error for event ${event}`, {
      error: String(e),
    })
    return new Response("Handler error", { status: 500 })
  }

  return new Response("ok", { status: 200 })
}
