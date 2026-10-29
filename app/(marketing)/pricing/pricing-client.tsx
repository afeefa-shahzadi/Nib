/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { useState, useEffect } from "react"
import { useMyPlan } from "@/hooks/use-my-plan"
import { WaitlistButton } from "@/components/waitlist-button"
import { useCurrency, formatINRMarket, formatINRPPP } from "@/lib/currency"
import { CurrencySelector } from "@/components/currency-selector"
import { PaymentConsentNote } from "@/components/payment-consent-note"
import Link from "next/link"
import { getTiers, getFAQ } from "@/lib/content/pricing/data"

// Client islands for the pricing page; everything else renders on the server.

export function CurrencyBar() {
  const { code } = useCurrency()
  const { launchFree } = useMyPlan()
  return (
    <>
            <CurrencySelector />
            {launchFree ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">
                Free during launch
              </span>
            ) : (
              <span className="opacity-70">· billed in {code} via Razorpay</span>
            )}
    </>
  )
}

/** Market-rate amount in the viewer's currency. */
export function MarketAmount({ inr }: { inr: number }) {
  const { code } = useCurrency()
  return <>{formatINRMarket(inr, code)}</>
}

export function FaqList() {
  const { code } = useCurrency()
  return (
    <>
      {getFAQ(code).map((f) => (
        <div key={f.q} className="hairline-t last:hairline-b py-5">
          <dt className="mb-2 font-display text-xl">{f.q}</dt>
          <dd className="leading-relaxed text-muted-foreground">
            {f.a}
          </dd>
        </div>
      ))}
    </>
  )
}

export function PricingPlans() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const { code } = useCurrency()
  const { launchFree } = useMyPlan()
  const allTiers = getTiers()
  const [isEdu, setIsEdu] = useState(false)
  const [isYearly, setIsYearly] = useState(false)

  useEffect(() => {
    import("@/lib/supabase/client").then(({ supabase }) =>
      supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    )
  }, [])

  return (
        <section className="container-wide mx-auto max-w-6xl py-8 md:py-10">
          <div className="flex flex-col items-center justify-center gap-4 mb-8 sm:flex-row">
            <div className="inline-flex items-center rounded-full border border-border bg-muted/30 p-1">
              <button
                onClick={() => setIsEdu(false)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${!isEdu ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground"}`}
              >
                For Individuals
              </button>
              <button
                onClick={() => setIsEdu(true)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${isEdu ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground"}`}
              >
                For Teams & Campuses
              </button>
            </div>

            <div className="inline-flex items-center rounded-full border border-border bg-muted/30 p-1">
              <button
                onClick={() => setIsYearly(false)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${!isYearly ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsYearly(true)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${isYearly ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground"}`}
              >
                Yearly
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
            {allTiers
              .filter((t) => !isEdu ? ["Reader / Creator", "Reader Pass", "Studio"].includes(t.name) : ["Organizations", "Enterprise", "Education"].includes(t.name))
              .map((t) => {
                const showYearly = isYearly && t.priceRupeesYearly !== undefined
                const price = showYearly ? t.priceRupeesYearly! : t.priceRupees
                const sub = showYearly ? (t.priceSubYearly ?? t.priceSub) : t.priceSub

                return (
                  <article
                    key={t.name}
                    className={`flex flex-col rounded-xl border p-6 md:p-7 ${t.accent ? "surface-elevated border-primary/40 ring-1 ring-primary/30" : "surface border-border/60"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h2 className="font-display text-xl text-foreground md:text-2xl">
                        {t.name}
                      </h2>
                      {showYearly && t.discountBadge && (
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                          {t.discountBadge}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-baseline gap-2">
                      <p className="font-display text-3xl text-foreground md:text-4xl">
                        {price === 0
                          ? (t.priceLabel ?? "Free")
                          : formatINRPPP(price, code)}
                      </p>
                      <span className="text-xs text-muted-foreground md:text-sm">
                        {sub}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{t.blurb}</p>
                    <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                      {t.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2 text-foreground/90"
                        >
                          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {t.name === "Studio" || t.name === "Reader Pass" ? (
                      <WaitlistButton
                        className="mt-8 w-full"
                        variant={t.accent ? "default" : "outline"}
                        size="lg"
                        item={t.name === "Studio" ? "studio" : "reader_pass"}
                        source="pricing"
                        signedIn={!!user}
                      />
                    ) : t.name === "Reader / Creator" ? (
                      <Button
                        className="mt-8"
                        variant={t.accent ? "default" : "outline"}
                        size="lg"
                        onClick={user ? () => router.push("/feed") : () => router.push("/signup")}
                      >
                        {user ? "Your Dashboard" : t.cta}
                      </Button>
                    ) : t.name === "Organizations" ? (
                      <Button
                        asChild
                        className="mt-8"
                        variant={t.accent ? "default" : "outline"}
                        size="lg"
                      >
                        <Link href={user ? t.ctaTo : "/signup?role=organization"}>{t.cta}</Link>
                      </Button>
                    ) : (
                      <Button
                        asChild
                        className="mt-8"
                        variant={t.accent ? "default" : "outline"}
                        size="lg"
                      >
                        <Link href={t.ctaTo}>{t.cta}</Link>
                      </Button>
                    )}
                  </article>
                )
              })}
          </div>
          <div className="container-wide">
            {!launchFree && <PaymentConsentNote className="mt-8 text-center" />}
          </div>
        </section>
  )
}
