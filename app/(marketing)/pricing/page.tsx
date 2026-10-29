import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"
import { LaunchPaymentsNotice } from "@/components/launch-payments-notice"
import { PAYOUT_MIN_INR } from "@/lib/currency-data"
import Link from "next/link"
import { COMPARE } from "@/lib/content/pricing/data"
import { CurrencyBar, FaqList, MarketAmount, PricingPlans } from "./pricing-client"

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
            <CurrencyBar />
          </div>
          <LaunchPaymentsNotice className="mx-auto mt-6 max-w-xl text-left" />
        </section>

        <PricingPlans />

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
                10,000 Insight Points = <MarketAmount inr={100} />.
              </strong>{" "}
              Payouts start at{" "}
              <strong className="text-foreground">
                <MarketAmount inr={PAYOUT_MIN_INR} />
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
              <FaqList />
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
