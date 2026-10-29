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
        <Check aria-label="Included" className="mx-auto size-4 text-primary" />
      ) : (
        <X aria-label="Not included" className="mx-auto size-4 text-muted-foreground/40" />
      )}
    </td>
  )
}

export default function Pricing() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <section className="container-wide pt-16 pb-8 text-center md:pt-24">
          <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl md:text-6xl">
            Free to read and write.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
            No ads. Pay only if you want more: a Reader Pass to fund the
            writers you read, or Studio to keep 100% of your tips.
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
                    <th className="sticky left-0 bg-background py-4 pr-3 text-left font-normal text-muted-foreground">
                      Feature
                    </th>
                    <th className="py-4 px-3 font-display text-base md:text-lg">
                      No account
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
                      <td className="sticky left-0 bg-background py-4 pr-4 font-medium text-foreground/90">
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
              Payouts start at{" "}
              <strong className="text-foreground">
                <MarketAmount inr={PAYOUT_MIN_INR} />
              </strong>{" "}
              to keep Razorpay fees from eating small balances.
            </p>
          </div>
        </section>

        <section className="hairline-t">
          <div className="container-wide grid gap-10 py-16 md:py-24 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <h2 className="font-display text-4xl leading-tight">
                Money, fairly explained.
              </h2>
            </div>
            <dl className="lg:col-span-7">
              <FaqList />
            </dl>
          </div>
        </section>

        <section className="hairline-t">
          <div className="container-wide py-16 text-center md:py-24">
            <h2 className="font-display text-4xl md:text-5xl">
              Start writing in two minutes.
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/signup">Start writing free</Link>
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
