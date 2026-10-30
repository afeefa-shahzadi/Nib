"use client"
import { createRazorpayOrder, createRazorpaySubscription, verifyRazorpayPayment } from "@/actions/payments"

type RzResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
type RzWindow = Window & { Razorpay?: new (o: Record<string, unknown>) => { open(): void } }

function loadCheckout(): Promise<void> {
  if ((window as RzWindow).Razorpay) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement("script")
    s.src = "https://checkout.razorpay.com/v1/checkout.js"
    s.onload = () => resolve()
    s.onerror = () => reject(new Error("Couldn't load checkout. Check your connection."))
    document.body.appendChild(s)
  })
}

// Opens Razorpay for a piece; resolves true once the payment is verified.
export function buyPiece(contentObjectId: string, collectionId?: string): Promise<boolean> {
  return payOnce({ kind: "piece", contentObjectId, collectionId, amountPaise: 0 })
}

// Opens Razorpay for a bundle; resolves true once the payment is verified.
export function buyBundle(bundleId: string): Promise<boolean> {
  return payOnce({ kind: "bundle", bundleId, amountPaise: 0 })
}

async function payOnce(data: Record<string, unknown>): Promise<boolean> {
  const order = await createRazorpayOrder({ data })
  await loadCheckout()
  return new Promise((resolve, reject) => {
    const Rz = (window as RzWindow).Razorpay!
    new Rz({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "Nib",
      handler: (r: RzResponse) => verifyRazorpayPayment({ data: r }).then(() => resolve(true), reject),
      modal: { ondismiss: () => resolve(false) },
    }).open()
  })
}

// Opens Razorpay for a monthly plan. The webhook turns the membership on.
export async function subscribeToTier(tierId: string): Promise<boolean> {
  const { subscriptionId, keyId } = await createRazorpaySubscription({ data: { tierId } })
  await loadCheckout()
  return new Promise((resolve) => {
    const Rz = (window as RzWindow).Razorpay!
    new Rz({
      key: keyId,
      subscription_id: subscriptionId,
      name: "Nib",
      handler: () => resolve(true),
      modal: { ondismiss: () => resolve(false) },
    }).open()
  })
}
