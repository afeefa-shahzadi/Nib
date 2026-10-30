"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { buyBundle } from "@/lib/razorpay/checkout-client"

export function BuyBundleButton({
  bundleId,
  price,
  signedIn,
  paymentsOpen,
  next,
}: {
  bundleId: string
  price: string
  signedIn: boolean
  paymentsOpen: boolean
  next: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (!paymentsOpen)
    return <p className="text-sm text-muted-foreground">Buying opens soon.</p>
  if (!signedIn)
    return (
      <Button asChild className="min-h-11">
        <Link href={`/login?redirect=${encodeURIComponent(next)}`}>Sign in to buy</Link>
      </Button>
    )

  const buy = async () => {
    setBusy(true)
    try {
      if (await buyBundle(bundleId)) {
        toast.success("Bundle unlocked. Enjoy the read.")
        router.refresh()
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button className="min-h-11" onClick={buy} disabled={busy}>
      {busy ? "Opening checkout…" : `Buy for ${price}`}
    </Button>
  )
}
