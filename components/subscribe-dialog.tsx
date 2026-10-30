"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { listAuthorTiers } from "@/actions/content/tiers"
import { subscribeToTier } from "@/lib/razorpay/checkout-client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"

type Tier = { id: string; name: string; description: string | null; price_cents: number }

export function SubscribeDialog({
  open,
  onOpenChange,
  authorId,
  authorName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  authorId: string
  authorName: string
}) {
  const router = useRouter()
  const [tiers, setTiers] = useState<Tier[] | null>(null)
  const [picked, setPicked] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || tiers) return
    listAuthorTiers({ data: { authorId } }).then((t) => {
      setTiers(t as Tier[])
      setPicked(t[0]?.id ?? "")
    })
  }, [open, tiers, authorId])

  const tier = tiers?.find((t) => t.id === picked)

  async function subscribe() {
    if (!tier) return
    setBusy(true)
    try {
      if (await subscribeToTier(tier.id)) {
        toast.success(`You're a member of ${authorName}. Access opens in a moment.`)
        onOpenChange(false)
        setTimeout(() => router.refresh(), 3000)
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Become a member</DialogTitle>
          <DialogDescription>
            Membership opens every supporters-only block by {authorName}. Billed monthly; cancel anytime.
          </DialogDescription>
        </DialogHeader>
        {!tiers ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : tiers.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{authorName} hasn&apos;t set up a membership plan yet.</p>
        ) : (
          <>
            <RadioGroup value={picked} onValueChange={setPicked} className="gap-2">
              {tiers.map((t) => (
                <Label
                  key={t.id}
                  htmlFor={`tier-${t.id}`}
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-[[data-state=checked]]:border-primary"
                >
                  <RadioGroupItem id={`tier-${t.id}`} value={t.id} className="mt-0.5" />
                  <span className="flex-1">
                    <span className="flex justify-between gap-2 font-medium">
                      {t.name}
                      <span className="tabular-nums">₹{t.price_cents / 100}/month</span>
                    </span>
                    {t.description && (
                      <span className="mt-1 block text-sm font-normal text-muted-foreground">{t.description}</span>
                    )}
                  </span>
                </Label>
              ))}
            </RadioGroup>
            <Button onClick={subscribe} disabled={!tier || busy} className="w-full">
              {busy ? <Spinner /> : `Subscribe · ₹${(tier?.price_cents ?? 0) / 100}/month`}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
