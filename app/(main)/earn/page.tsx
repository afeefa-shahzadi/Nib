 
"use client"

import { useQuery } from "@tanstack/react-query"
import { CurrencySelector } from "@/components/currency-selector"
import {
  useCurrency,
  formatINRMarket,
  PAYOUT_MIN_INR,
} from "@/lib/currency"
import { monthlyLeaderboard } from "@/actions/monetization"
import { Check, Coins, Flame, Heart, Layers, Library, Megaphone, Sparkles, Trophy, Users } from "lucide-react"
import { LaunchPaymentsNotice } from "@/components/launch-payments-notice"
import Link from "next/link"
import { formatCompactNumber } from "@/lib/utils"

type Stream = {
  icon: React.ReactNode
  title: string
  payout: string
  blurb: string
  details: string[]
}

// Figures mirror actions/monetization/payments.ts (calculateAuthorNetPaise) and lib/reader-pool.ts.
function moneyStreams(fmt: (rupees: number) => string): Stream[] {
  return [
    {
      icon: <Heart className="size-5 text-primary" aria-hidden />,
      title: "Tips",
      payout: `From ${fmt(20)} per tip`,
      blurb: "Readers tip the pieces they value.",
      details: [
        "Free plan: you keep 90%",
        `Studio: you keep 100% up to ${fmt(50000)} a month, then 95%`,
      ],
    },
    {
      icon: <Megaphone className="size-5 text-primary" aria-hidden />,
      title: "Sponsorships",
      payout: "You keep 80%",
      blurb: "Organizations back a piece, with a clear disclosure on the page.",
      details: [
        `Minimum sponsorship ${fmt(1000)}`,
        "You can decline any sponsor",
      ],
    },
    {
      icon: <Layers className="size-5 text-primary" aria-hidden />,
      title: "Bundles and supporters-only blocks",
      payout: "You keep 90%, or 100% on Studio",
      blurb: "Sell a bundle of pieces, or lock the parts of a piece worth paying for.",
      details: [
        "Same split as tips",
        "Block-level locks need Studio",
      ],
    },
    {
      icon: <Coins className="size-5 text-primary" aria-hidden />,
      title: "Memberships",
      payout: "Monthly income from members",
      blurb: "Run membership tiers at a price you set.",
      details: [
        "Needs Studio or Organizations",
        "Razorpay handles renewals and GST",
      ],
    },
    {
      icon: <Library className="size-5 text-primary" aria-hidden />,
      title: "Curator share",
      payout: "15% of sales from your collection",
      blurb: "Build a public collection. When a reader buys a piece from it, you earn a share.",
      details: [
        "Only on pieces whose authors opt in",
        "Starts when paid pieces go on sale",
      ],
    },
    {
      icon: <Users className="size-5 text-primary" aria-hidden />,
      title: "Reader Pass pool",
      payout: "85% of every pass goes to writers",
      blurb: "Each month, a reader's pass is shared among the writers they clapped for.",
      details: [
        "Nothing to set up",
        "Readers see where their pass went",
      ],
    },
  ]
}

const RECOGNITION = [
  { icon: Sparkles, title: "Insight Points", body: "Earned by reading, clapping, annotating, publishing and replying. Up to 25 a day as a reader and 33 as an author." },
  { icon: Flame, title: "Streak bonuses", body: "+50 at 7 days, +250 at 30 days and +1,000 at 100 days in a row." },
  { icon: Trophy, title: "Monthly leaderboard", body: "The most engaged readers and writers, ranked by points. Resets on the 1st." },
]

export default function EarnPage() {
  const { code } = useCurrency()
  const fmt = (r: number) => formatINRMarket(r, code)
  const leaderboardFn = monthlyLeaderboard
  const { data: lb } = useQuery({
    queryKey: ["earn-leaderboard"],
    queryFn: () => leaderboardFn(),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <section className="container-wide grid gap-8 pt-16 pb-12 md:pt-24 lg:grid-cols-12 lg:items-end lg:gap-16">
          <div className="lg:col-span-7">
          <h1 className="max-w-3xl font-display text-4xl leading-[1.05] sm:text-5xl md:text-6xl">
            Get paid for your writing
          </h1>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
            No ads. Money comes only from readers who choose to pay and
            sponsors who choose to back you.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>Showing amounts in</span>
            <CurrencySelector />
            <span>Paid out in INR through Razorpay.</span>
          </div>
          </div>
          <LaunchPaymentsNotice className="lg:col-span-5" />
        </section>

        <section className="container-wide pb-16 md:pb-24">
          <h2 className="mb-6 font-display text-2xl md:text-3xl">Six ways to earn money</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
            {moneyStreams(fmt).map((s) => (
              <article key={s.title} className="surface flex flex-col rounded-xl border border-border/60 p-4 sm:p-6">
                {s.icon}
                <h3 className="mt-3 font-display text-xl text-foreground">{s.title}</h3>
                <p className="mt-1 text-sm font-medium text-primary">{s.payout}</p>
                <p className="mt-2 text-sm text-muted-foreground">{s.blurb}</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-foreground/80">
                  {s.details.map((d) => (
                    <li key={d} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      {d}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="hairline-t">
          <div className="container-wide py-16 md:py-24">
            <h2 className="font-display text-2xl md:text-3xl">Recognition, not cash</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Points rank you and unlock profile perks. They never turn into money.
            </p>
            <dl className="mt-8 grid gap-8 md:grid-cols-3">
              {RECOGNITION.map(({ icon: Icon, title, body }) => (
                <div key={title}>
                  <dt className="flex items-center gap-2 font-display text-xl">
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                    {title}
                  </dt>
                  <dd className="mt-1 text-muted-foreground">{body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="hairline-t">
          <div className="container-wide grid items-start gap-10 py-16 md:py-24 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="font-display text-2xl md:text-3xl">Getting your money</h2>
              <ul className="mt-6 space-y-3 text-foreground/90">
                <li className="flex gap-2">
                  <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                  Earnings reach your balance after a 7-day clearing period.
                </li>
                <li className="flex gap-2">
                  <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                  Withdraw once your balance reaches {fmt(PAYOUT_MIN_INR)}, so
                  Razorpay fees don&apos;t eat small amounts.
                </li>
                <li className="flex gap-2">
                  <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                  Payouts usually arrive in 2–3 business days.
                </li>
              </ul>
            </div>
            <div className="surface rounded-xl border border-border/60 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Trophy className="size-4 text-note" />
                <h3 className="font-display text-lg">
                  This month&apos;s leaderboard
                </h3>
              </div>
              {!lb || lb.entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No entries yet this month — be the first.
                </p>
              ) : (
                <ol className="space-y-2 text-sm">
                  {lb.entries.map((e) => (
                    <li
                      key={e.userId}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="w-6 font-display text-muted-foreground">
                          #{e.rank}
                        </span>
                        {e.handle ? (
                          <Link
                            href={`/u/${e.handle}`}
                            className="truncate hover:text-primary"
                          >
                            {e.displayName}
                          </Link>
                        ) : (
                          <span className="truncate">{e.displayName}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-foreground tabular-nums">
                        {formatCompactNumber(e.points)} IP
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                Updates hourly. Resets on the 1st of next month.
              </p>
            </div>
          </div>
        </section>

        <section className="hairline-t">
          <div className="container-wide py-20 text-center">
            <h2 className="font-display text-3xl md:text-5xl">
              Start earning today.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Sign up free and publish. Your pieces earn points from day one,
              and money as soon as payments open.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center rounded-md bg-primary px-5 py-3 text-primary-foreground transition hover:opacity-90"
              >
                Get started free
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center rounded-md border border-border px-5 py-3 transition hover:bg-muted"
              >
                See pricing
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
