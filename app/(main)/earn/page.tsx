 
"use client"

import { useQuery } from "@tanstack/react-query"
import { CurrencySelector } from "@/components/currency-selector"
import {
  useCurrency,
  formatINRMarket,
  PAYOUT_MIN_INR,
} from "@/lib/currency"
import { monthlyLeaderboard } from "@/actions/monetization"
import {
  Coins,
  Heart,
  Layers,
  Megaphone,
  Flame,
  Trophy,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { useMyPlan } from "@/hooks/use-my-plan"
import { formatCompactNumber } from "@/lib/utils"

type Stream = {
  icon: React.ReactNode
  title: string
  who: "Reader" | "Author" | "Curator" | "Annotator"
  payout: string
  blurb: string
  details: string[]
}

function streams(fmt: (rupees: number) => string, launchFree: boolean): Stream[] {
  return [
    {
      icon: <Heart className="size-5 text-destructive" />,
      title: "Tips from readers",
      who: "Author",
      payout: `${fmt(20)} – ∞ per tip`,
      blurb:
        "Readers tip pieces they love. You keep 90% on Free, 100% on Studio.",
      details: [
        "Free tier: 10% platform fee, 90% to author",
        "Studio tier: 0% platform fee, 100% to author",
        "Razorpay-settled, no monthly cap",
      ],
    },
    {
      icon: <Layers className="size-5 text-success" />,
      title: "Curator Collections",
      who: "Curator",
      payout: "15% of every sale in your collection",
      blurb:
        "Bundle paid pieces into a themed collection. You earn 15% of every sale; authors keep 70%.",
      details: [
        "Curator: 15% · Author: 70% · Platform: 15%",
        "Works on paid pieces and gated blocks",
        "No cap on collection size",
      ],
    },
    {
      icon: <Megaphone className="size-5 text-note" />,
      title: "Sponsored Pieces",
      who: "Author",
      payout: "80% of the sponsor deal",
      blurb:
        "Accept brand sponsorships transparently. 80% to author, 20% to platform.",
      details: [
        "Disclosed via SponsoredBanner on the reader page",
        "You set the rate; sponsors pay through Razorpay",
        "Author can decline any sponsor at any time",
      ],
    },
    {
      icon: <Sparkles className="size-5 text-success" />,
      title: "Insight Points (daily quests)",
      who: "Reader",
      payout: `Up to 58 IP/day (≈ ${fmt(5.8)})`,
      blurb:
        "Auto-tracked as you read, clap, annotate, follow, publish, or reply.",
      details: [
        "Reader quests cap at 25 IP/day",
        "Author quests cap at 33 IP/day",
        "Status points that rank you on the leaderboard — not cashable",
      ],
    },
    {
      icon: <Flame className="size-5 text-warn" />,
      title: "Reading-streak bonuses",
      who: "Reader",
      payout: "+50 / +250 / +1000 IP",
      blurb:
        "Show up daily. Every milestone drops a bonus into your IP balance.",
      details: [
        `7-day streak: +50 IP${launchFree ? "" : " (≈ ₹5)"}`,
        `30-day streak: +250 IP${launchFree ? "" : " (≈ ₹25)"}`,
        `100-day streak: +1000 IP${launchFree ? "" : " (≈ ₹100)"}`,
      ],
    },
    {
      icon: <Trophy className="size-5 text-note" />,
      title: "Monthly leaderboard",
      who: "Reader",
      payout: "Recognition for the most engaged",
      blurb:
        "The most engaged readers and writers each month top the public leaderboard.",
      details: [
        "Ranked by Insight Points earned",
        "Resets on the 1st of each month",
        "Public profile — build your reputation",
      ],
    },
    {
      icon: <Coins className="size-5 text-note" />,
      title: "Memberships (Studio)",
      who: "Author",
      payout: "100% of subscription revenue",
      blurb:
        "Studio authors run paid membership tiers. Recurring revenue, zero platform cut.",
      details: [
        "Requires Studio (₹499/mo)",
        "Set your own monthly price",
        "Razorpay handles renewals + GST",
      ],
    },
  ]
}

export default function EarnPage() {
  const { code } = useCurrency()
  const { launchFree } = useMyPlan()
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
        <section className="container-wide pt-16 pb-10 text-center md:pt-24">
          <p className="text-xs tracking-[0.22em] text-primary uppercase">
            Earn on Nib
          </p>
          <h1 className="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl md:text-6xl">
            Eight ways to get paid
            <br />
            for thoughtful work.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl px-4 text-base text-muted-foreground md:text-lg">
            No ads. No surveillance. Every rupee comes from readers who chose to
            pay or sponsors who chose to back you.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            <span>Showing amounts in</span>
            <CurrencySelector />
            <span>· paid out in INR via Razorpay</span>
          </div>
        </section>

        <section className="container-wide grid gap-4 pb-10 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {streams(fmt, launchFree).map((s) => (
            <article
              key={s.title}
              className="surface flex flex-col rounded-xl border border-border/60 p-6"
            >
              <div className="flex items-center gap-3">
                {s.icon}
                <span className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                  {s.who}
                </span>
              </div>
              <h2 className="mt-3 font-display text-xl text-foreground">
                {s.title}
              </h2>
              <p className="mt-1 text-sm font-medium text-primary">
                {s.payout}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{s.blurb}</p>
              <ul className="mt-4 flex-1 space-y-1.5 text-xs text-foreground/80">
                {s.details.map((d) => (
                  <li key={d} className="flex gap-2">
                    <span className="mt-0.5 text-primary">·</span>
                    {d}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="hairline-t">
          <div className="container-wide grid items-start gap-10 py-14 md:grid-cols-2">
            <div>
              <p className="mb-3 text-xs tracking-[0.22em] text-primary uppercase">
                Cash out
              </p>
              <h2 className="font-display text-3xl leading-tight md:text-4xl">
                When does it become money?
              </h2>
              <ul className="mt-6 space-y-3 text-sm text-foreground/90">
                <li>
                  · <strong>Insight Points are not cash.</strong> They&apos;re
                  status points that rank you on the leaderboard — real money
                  comes only from the streams below.
                </li>
                <li>
                  · Tips, Curator splits, and Sponsored deals
                  settle the moment the buyer&apos;s payment clears.
                </li>
                <li>
                  · <strong>Payout floor: {fmt(PAYOUT_MIN_INR)}.</strong> A
                  floor exists so Razorpay processing fees don&apos;t eat small
                  balances.
                </li>
                <li>
                  · Request a payout any time once you cross the floor — usually
                  settles within 2–3 business days.
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
              Sign up free. Your first published piece is eligible for tips
              and IP from day one.
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
