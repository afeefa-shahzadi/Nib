"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { finishConsentCardCheck, startConsentCardCheck } from "@/actions/parental-consent"

type RzWindow = Window & { Razorpay?: new (o: Record<string, unknown>) => { open(): void } }

// ₹1 charge on an adult's card, refunded straight after approval.
export function CardCheck({ u, t }: { u: string; t: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const run = async () => {
    const adult = (document.getElementById("declare-adult") as HTMLInputElement | null)?.checked
    if (!adult) return toast.error("Tick the box above first.")
    setBusy(true)
    try {
      const o = await startConsentCardCheck(u, t)
      if (!(window as RzWindow).Razorpay)
        await new Promise<void>((res, rej) => {
          const s = document.createElement("script")
          s.src = "https://checkout.razorpay.com/v1/checkout.js"
          s.onload = () => res()
          s.onerror = () => rej(new Error("Couldn't load checkout."))
          document.body.appendChild(s)
        })
      new (window as RzWindow).Razorpay!({
        key: o.keyId,
        order_id: o.orderId,
        amount: o.amount,
        currency: "INR",
        name: "Nib",
        description: "Parent check (refunded)",
        handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await finishConsentCardCheck(u, t, r, true)
            router.refresh()
          } catch (e) {
            toast.error((e as Error).message)
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      }).open()
    } catch (e) {
      toast.error((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <Button type="button" variant="outline" className="w-full" onClick={run} disabled={busy}>
      Verify with a card (₹1, refunded)
    </Button>
  )
}
