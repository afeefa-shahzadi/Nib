"use client"
import { WaitlistButton } from "@/components/waitlist-button"
import { useAuth } from "@/hooks/use-auth"
import { Sparkles } from "lucide-react"
import { TierItem } from "@/lib/types/content"

export function MembershipTiers({
  tiers,
}: {
  tiers: TierItem[]
  authorName?: string
}) {
  const { user } = useAuth()

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
            {t.price_cents > 0 ? (
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
