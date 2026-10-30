"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { WaitlistButton } from "@/components/waitlist-button"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { subscribeToTier } from "@/lib/razorpay/checkout-client"
import { useAuth } from "@/hooks/use-auth"
import { Sparkles } from "lucide-react"
import { TierItem } from "@/lib/types/content"

export function MembershipTiers({
  tiers,
  authorId,
  authorName,
  paymentsOpen,
}: {
  tiers: TierItem[]
  authorId: string
  authorName?: string
  paymentsOpen: boolean
}) {
  const { user } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  async function subscribe(tierId: string) {
    if (!user) return router.push("/login")
    setBusy(tierId)
    try {
      if (await subscribeToTier(tierId)) {
        toast.success(`You're a member of ${authorName ?? "this author"}. Access opens in a moment.`)
        setTimeout(() => router.refresh(), 3000)
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (tiers.length === 0) return null

  return (
    <section className="mt-12">
      <h2 className="mb-4 flex items-center gap-2 font-display text-xl text-foreground">
        <Sparkles className="size-4 text-primary" /> Memberships
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiers.map((t) => (
          <article key={t.id} className="surface flex flex-col rounded-md p-5">
            <p className="font-display text-lg text-foreground">{t.name}</p>
            <p className="mt-1 font-display text-2xl text-foreground">
              ₹{(t.price_cents / 100).toLocaleString("en-IN")}
              <span className="text-sm text-muted-foreground"> / month</span>
            </p>
            {t.description && (
              <p className="mt-2 text-sm text-muted-foreground">
                {t.description}
              </p>
            )}
            {t.perks.length > 0 && (
              <ul className="mt-3 flex-1 space-y-1 text-sm text-foreground/90">
                {t.perks.map((p) => (
                  <li key={p}>· {p}</li>
                ))}
              </ul>
            )}
            {t.price_cents > 0 && user?.id === authorId ? (
              <p className="mt-4 text-sm text-muted-foreground">Your plan</p>
            ) : t.price_cents > 0 && paymentsOpen ? (
              <Button className="mt-4 min-h-11 lg:min-h-9" disabled={busy !== null} onClick={() => subscribe(t.id)}>
                {busy === t.id ? <Spinner /> : "Subscribe"}
              </Button>
            ) : t.price_cents > 0 ? (
              <WaitlistButton className="mt-4" item="membership" source="membership_tiers" signedIn={!!user} />
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Free</p>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
