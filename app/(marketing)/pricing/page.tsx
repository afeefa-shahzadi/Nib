/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"
import { useState, useEffect } from "react"
import { useMyPlan } from "@/hooks/use-my-plan"
import { WaitlistButton } from "@/components/waitlist-button"
import { LaunchPaymentsNotice } from "@/components/launch-payments-notice"
import {
  useCurrency,
  formatINRMarket,
  PAYOUT_MIN_INR,
  formatINRPPP,
} from "@/lib/currency"
import { CurrencySelector } from "@/components/currency-selector"
import { PaymentConsentNote } from "@/components/payment-consent-note"
import Link from "next/link"
import { getTiers, COMPARE, getFAQ } from "@/lib/content/pricing/data"

function PriceCell({ v }: { v: boolean | string }) {
  if (typeof v === "string")
    return (
      <td className="py-4 px-3 text-center font-display text-foreground">{v}</td>
    )
  return (
    <td className="py-4 px-3 text-center">
      {v ? (
        <Check className="mx-auto size-4 text-primary" />
      ) : (
        <X className="mx-auto size-4 text-muted-foreground/40" />
      )}
    </td>
  )
}

export default function Pricing() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const { code } = useCurrency()
  const { launchFree } = useMyPlan()
  const allTiers = getTiers()
  const faqList = getFAQ(code)
  const [isEdu, setIsEdu] = useState(false)
  const [isYearly, setIsYearly] = useState(false)

  useEffect(() => {
    import("@/lib/supabase/client").then(({ supabase }) =>
      supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    )
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <section className="container-wide pt-16 pb-8 text-center md:pt-24">
          <p className="text-xs tracking-[0.22em] text-primary uppercase">
            Pricing
          </p>
          <h1 className="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl md:text-7xl">
            Free to write.
            <br />
            Paid only when you scale.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl px-4 text-base text-muted-foreground md:text-lg">
            No ads. Ever. We earn when you earn — and we don&apos;t even take a
            cut on Studio.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            <span>Showing prices in</span>
            <CurrencySelector />
            {launchFree ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">
                Free during launch
              </span>
            ) : (
              <span className="opacity-70">· billed in {code} via Razorpay</span>
            )}
          </div>
          <LaunchPaymentsNotice className="mx-auto mt-6 max-w-xl text-left" />
        </section>

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
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wide">
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

        <section className="hairline-t">
          <div className="container-wide py-14 md:py-20">
            <p className="mb-3 text-xs tracking-[0.22em] text-primary uppercase">
              Compare
            </p>
            <h2 className="mb-3 font-display text-2xl md:text-4xl">
              Feature by feature.
            </h2>
            <p className="mb-8 text-xs text-muted-foreground md:mb-10 lg:hidden">
              Scroll horizontally to compare all plans →
            </p>
            <div className="-mx-4 overflow-x-auto px-4 pb-6">
              <table className="w-full min-w-225 text-sm">
                <thead>
                  <tr className="hairline-b">
                    <th className="py-4 pr-3 text-left font-normal text-muted-foreground">
                      Feature
                    </th>
                    <th className="py-4 px-3 font-display text-base md:text-lg">
                      Anon
                    </th>
                    <th className="py-4 px-3 font-display text-base md:text-lg">
                      Free
                    </th>
                    <th className="py-4 px-3 font-display text-base md:text-lg">
                      Pass
                    </th>
                    <th className="py-4 px-3 font-display text-base md:text-lg">
                      Studio
                    </th>
                    <th className="py-4 px-3 font-display text-base md:text-lg">
                      Org
                    </th>
                    <th className="py-4 px-3 font-display text-base md:text-lg">
                      Enterprise
                    </th>
                    <th className="py-4 px-3 font-display text-base md:text-lg">
                      Edu
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map(([feat, ...vals]) => (
                    <tr key={feat as string} className="hairline-t hover:bg-muted/30">
                      <td className="py-4 pr-4 text-foreground/90 font-medium">
                        {feat as string}
                      </td>
                      {(vals as (boolean | string)[]).map((v, i) => (
                        <PriceCell key={i} v={v} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              <strong className="text-foreground">
                10,000 Insight Points = {formatINRMarket(100, code)}.
              </strong>{" "}
              Payouts start at{" "}
              <strong className="text-foreground">
                {formatINRMarket(PAYOUT_MIN_INR, code)}
              </strong>{" "}
              to keep Razorpay fees from eating small balances.
            </p>
          </div>
        </section>

        <section className="hairline-t">
          <div className="container-wide grid gap-10 py-20 md:grid-cols-12">
            <div className="md:col-span-4">
              <p className="mb-3 text-xs tracking-[0.22em] text-primary uppercase">
                FAQ
              </p>
              <h2 className="font-display text-4xl leading-tight">
                Money, fairly explained.
              </h2>
            </div>
            <dl className="space-y-px md:col-span-8">
              {faqList.map((f) => (
                <div key={f.q} className="hairline-t last:hairline-b py-5">
                  <dt className="mb-2 font-display text-xl">{f.q}</dt>
                  <dd className="leading-relaxed text-muted-foreground">
                    {f.a}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="hairline-t">
          <div className="container-wide py-24 text-center">
            <h2 className="font-display text-4xl md:text-5xl">
              Start writing in two minutes.
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/signup">Open your studio</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/docs">Read the docs</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
