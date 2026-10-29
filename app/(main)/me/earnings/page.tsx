"use client"

import { useEffect, useState } from "react"
import { getMyEarnings, getMyReaderImpact } from "@/actions/monetization"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  useCurrency,
  formatPaiseMarket,
  PAYOUT_MIN_INR,
} from "@/lib/currency"
import {
  Wallet,
  Sparkles,
  Heart,
  BookOpen,
  Flame,
  TrendingUp,
} from "lucide-react"
import { LeaderboardRankCard } from "@/components/leaderboard-rank-card"
import { FlairShop } from "@/components/flair-shop"
import Link from "next/link"
import { LaunchPaymentsNotice } from "@/components/launch-payments-notice"
import { useMyPlan } from "@/hooks/use-my-plan"
import { formatCompactNumber } from "@/lib/utils"

type EData = Awaited<ReturnType<typeof getMyEarnings>>

export default function MyEarnings() {
  const { code } = useCurrency()
  const { launchFree } = useMyPlan()
  const fetchE = getMyEarnings
  const [data, setData] = useState<EData | null>(null)
  const [impact, setImpact] = useState<Awaited<
    ReturnType<typeof getMyReaderImpact>
  > | null>(null)
  const [stats, setStats] = useState<{
    claps: number
    pieces: number
    follows: number
    streak: number
    longest: number
  } | null>(null)

  useEffect(() => {
    fetchE()
      .then(setData)
      .catch(() => {})
    getMyReaderImpact()
      .then(setImpact)
      .catch(() => {})
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      if (!u.user) return
      const uid = u.user.id
      const [
        { count: claps },
        { count: pieces },
        { count: follows },
        { data: streak },
      ] = await Promise.all([
        supabase
          .from("piece_claps")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid),
        supabase
          .from("content_objects")
          .select("id", { count: "exact", head: true })
          .eq("author_id", uid)
          .eq("status", "published"),
        supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", uid),
        supabase
          // Canonical streak lives in user_stats (written by tickReadingStreak);
          // reading_streaks is legacy/unwritten by the current flow.
          .from("user_stats")
          .select("current_streak, longest_streak")
          .eq("user_id", uid)
          .maybeSingle(),
      ])
      setStats({
        claps: claps ?? 0,
        pieces: pieces ?? 0,
        follows: follows ?? 0,
        streak: streak?.current_streak ?? 0,
        longest: streak?.longest_streak ?? 0,
      })
    })()
  }, [fetchE])

  if (!data)
    return (
      <div className="min-h-screen bg-background">
        <div className="container-wide py-20 text-sm text-muted-foreground">
          Loading…
        </div>
      </div>
    )


  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="container-wide max-w-5xl flex-1 pt-16 pb-10 md:pt-24 md:pb-16">
        <header className="mb-8">
          <p className="text-xs tracking-[0.22em] text-primary uppercase">
            My monetization
          </p>
          <h1 className="mt-2 font-display text-3xl md:text-5xl">
            Your earnings, points, and reach.
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Cash comes from tips and sales — payouts start at{" "}
            <strong className="text-foreground">₹{PAYOUT_MIN_INR}</strong>.
            Insight Points are a separate reward for reading and contributing:
            they are not currency and never convert to cash.
          </p>
        </header>
        <LaunchPaymentsNotice className="mb-8" />

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            icon={<Wallet className="size-4" />}
            label="Available"
            value={formatPaiseMarket(data.available, code)}
            sub={
              data.held > 0
                ? `${formatPaiseMarket(data.held, code)} clearing (7 days)`
                : undefined
            }
            accent
          />
          <Stat
            icon={<TrendingUp className="size-4" />}
            label="Lifetime net"
            value={formatPaiseMarket(data.lifetimeNet, code)}
          />
          <Stat
            icon={<Sparkles className="size-4" />}
            label="Insight Points"
            value={formatCompactNumber(data.points)}
            sub="Status points · not currency"
          />
          <Stat
            icon={<Flame className="size-4" />}
            label="Reading streak"
            value={`${stats?.streak ?? 0}d`}
            sub={`best ${stats?.longest ?? 0}d`}
          />
        </section>

        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat
            icon={<Heart className="size-4" />}
            label="Claps given"
            value={formatCompactNumber(stats?.claps ?? 0)}
          />
          <Stat
            icon={<BookOpen className="size-4" />}
            label="Pieces published"
            value={formatCompactNumber(stats?.pieces ?? 0)}
          />
          <Stat
            icon={<TrendingUp className="size-4" />}
            label="Following"
            value={formatCompactNumber(stats?.follows ?? 0)}
          />
        </section>

        <section className="mt-6">
          <LeaderboardRankCard audience="reader" />
        </section>

        <FlairShop />

        <section className="surface mt-10 rounded-md p-5">
          <h2 className="mb-2 font-display text-lg">Payouts</h2>
          {launchFree ? (
            <p className="text-sm text-muted-foreground">
              Payouts open after launch. Your earnings keep accruing until then.
            </p>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Cash out via Razorpay once you&apos;ve earned{" "}
                <strong className="text-foreground">₹{PAYOUT_MIN_INR}</strong>. This
                floor prevents processing fees from eating your earnings.
              </p>
              <Button
                asChild
                size="sm"
                variant={
                  data.available >= PAYOUT_MIN_INR * 100 ? "default" : "outline"
                }
              >
                <Link href="/studio/earnings">
                  {data.available >= PAYOUT_MIN_INR * 100
                    ? "Request payout"
                    : "Open earnings dashboard"}
                </Link>
              </Button>
            </>
          )}
        </section>

        {impact && impact.periodEnd && impact.splits.length > 0 && (
          <section className="surface mt-10 rounded-md p-5">
            <h2 className="mb-1 font-display text-lg">Your Reader Pass impact</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Last month your Reader Pass sent{" "}
              <strong className="text-foreground">
                {formatPaiseMarket(impact.total, code)}
              </strong>{" "}
              to {impact.splits.length}{" "}
              {impact.splits.length === 1 ? "creator" : "creators"} you clapped
              for — no allocation needed, your reading directed it.
            </p>
            <ul className="space-y-2">
              {impact.splits.map((s, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-md px-4 py-2.5 text-sm ring-1 ring-border/60"
                >
                  <span>
                    {s.name}
                    {s.handle && (
                      <span className="text-muted-foreground"> @{s.handle}</span>
                    )}
                  </span>
                  <span className="text-foreground/80">
                    {formatPaiseMarket(s.amountPaise, code)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10">
          <h2 className="mb-3 font-display text-lg">Recent activity</h2>
          {data.ledger.length === 0 && data.payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing yet — earnings will appear here as you tip, get tipped, or
              win annotation rewards.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.ledger.slice(0, 20).map((r, i) => (
                <li
                  key={i}
                  className="surface flex items-center justify-between rounded-md px-4 py-2.5 text-sm"
                >
                  <span className="capitalize">
                    {r.source.replace(/_/g, " ")}
                  </span>
                  <span className="text-foreground/80">
                    {formatPaiseMarket(r.net_paise, code)}
                  </span>
                </li>
              ))}
              {data.payouts.map((p) => (
                <li
                  key={p.id}
                  className="surface flex items-center justify-between rounded-md px-4 py-2.5 text-sm"
                >
                  <span>Payout · {p.status}</span>
                  <span>−{formatPaiseMarket(p.amount_paise, code)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div
      className={`surface rounded-md p-4 ${accent ? "ring-1 ring-primary/40" : ""}`}
    >
      <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 truncate font-display text-2xl">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}
