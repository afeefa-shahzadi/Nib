"use server"
import { createHmac, timingSafeEqual } from "crypto"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { consentStatus, grantConsent, sendParentalConsentEmail, verifyConsentLink } from "@/lib/parental-consent"
import { CARD_CHECK_PAISE, cardCheckEnabled } from "@/lib/consent-methods"
import { rzFetch } from "@/lib/razorpay/api"

async function requestMeta() {
  const h = await headers()
  return {
    ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
    userAgent: h.get("user-agent"),
  }
}

export async function getMyConsentStatus() {
  const { data } = await (await createClient()).auth.getUser()
  return data.user ? consentStatus(data.user.id) : "not_required"
}

export async function resendParentalConsent() {
  const { data } = await (await createClient()).auth.getUser()
  if (!data.user) throw new Error("Sign in first.")
  const r = await sendParentalConsentEmail(data.user.id)
  if (r === "failed") throw new Error("We couldn't send the email just now. Try again in a few minutes.")
  if (r === "too_soon") throw new Error("We sent one a few minutes ago. Check your parent's inbox, or try again in 10 minutes.")
  return r
}

// Email link + adult declaration. The link's HMAC proves it came from that inbox.
export async function grantParentalConsent(userId: string, token: string, declaredAdult: boolean) {
  return grantConsent(userId, token, { method: "email", declaredAdult, ...(await requestMeta()) })
}

// ₹1 card check (dormant during launch): charge, verify, approve, refund.
export async function startConsentCardCheck(userId: string, token: string) {
  if (!cardCheckEnabled()) throw new Error("Card check isn't available yet.")
  if (!(await verifyConsentLink(userId, token))) throw new Error("This approval link isn't valid.")
  const order = (await rzFetch("/orders", {
    method: "POST",
    body: JSON.stringify({ amount: CARD_CHECK_PAISE, currency: "INR", notes: { purpose: "parental_consent", user_id: userId } }),
  })) as { id: string }
  return { orderId: order.id, amount: CARD_CHECK_PAISE, keyId: process.env.RAZORPAY_KEY_ID! }
}

export async function finishConsentCardCheck(
  userId: string,
  token: string,
  r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
  declaredAdult: boolean
) {
  if (!cardCheckEnabled()) throw new Error("Card check isn't available yet.")
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${r.razorpay_order_id}|${r.razorpay_payment_id}`)
    .digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(r.razorpay_signature)
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Payment couldn't be verified.")
  const order = (await rzFetch(`/orders/${r.razorpay_order_id}`)) as { notes?: { user_id?: string; purpose?: string } }
  if (order.notes?.purpose !== "parental_consent" || order.notes.user_id !== userId)
    throw new Error("Payment couldn't be verified.")
  const out = await grantConsent(userId, token, {
    method: "card",
    declaredAdult,
    reference: r.razorpay_payment_id,
    ...(await requestMeta()),
  })
  // The charge only proves an adult's card; give it straight back.
  await rzFetch(`/payments/${r.razorpay_payment_id}/refund`, { method: "POST", body: JSON.stringify({ amount: CARD_CHECK_PAISE }) }).catch(
    (e) => console.error("[consent] refund failed", r.razorpay_payment_id, e)
  )
  return out
}
