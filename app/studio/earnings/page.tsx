"use client"

import { StudioSkeleton } from "@/components/studio/studio-skeleton"
import { useCallback, useEffect, useState } from "react"
import {
  getMyEarnings,
  requestPayout,
  getMyCreatorPoolImpact,
  redeemStudioFromEarnings,
} from "@/actions/monetization"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LaunchPaymentsNotice } from "@/components/launch-payments-notice"
import { useMyPlan } from "@/hooks/use-my-plan"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  Wallet,
  TrendingUp,
  Coins,
  Sparkles,
  ArrowUpRight,
  Users,
  ShoppingBag,
  Megaphone,
  Library,
  Undo2,
  CreditCard,
} from "lucide-react"
import { formatCompactNumber } from "@/lib/utils"
import { PayoutMethods, PayoutMethodPicker } from "./payout-methods"
import type { MaskedPayoutMethod } from "@/actions/monetization/payout-methods"

type Data = Awaited<ReturnType<typeof getMyEarnings>>

function rs(p: number) {
  return `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}

const day = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

// Same 7-day chargeback hold the balance uses.
const HOLD_MS = 7 * 86_400_000

const SOURCE: Record<string, { label: string; icon: typeof Wallet }> = {
  membership: { label: "Membership", icon: Users },
  purchase: { label: "Sale", icon: ShoppingBag },
  sponsorship: { label: "Sponsorship", icon: Megaphone },
  curator_share: { label: "Curator share", icon: Library },
  studio_credit: { label: "Studio credit", icon: CreditCard },
  chargeback: { label: "Chargeback", icon: Undo2 },
}

const PAYOUT_STATUS: Record<string, string> = {
  paid: "Paid",
  failed: "Failed",
  rejected: "Declined",
}

export default function EarningsPage() {
  const fetchFn = getMyEarnings
  const payoutFn = requestPayout
  const [data, setData] = useState<Data | null>(null)
  const [pool, setPool] = useState<Awaited<
    ReturnType<typeof getMyCreatorPoolImpact>
  > | null>(null)
  const [amount, setAmount] = useState("400")
  const [destination, setDestination] = useState("")
  const [methods, setMethods] = useState<MaskedPayoutMethod[]>([])
  const [methodId, setMethodId] = useState("")
  const [busy, setBusy] = useState(false)
  const { launchFree } = useMyPlan()
  const [redeeming, setRedeeming] = useState(false)
  const [now] = useState(() => Date.now())
  const [loadError, setLoadError] = useState(false)

  const reload = useCallback(
    () =>
      fetchFn()
        .then((d) => {
          setData(d)
          setLoadError(false)
        })
        .catch((e) => {
          console.error("[earnings] load failed", e)
          setLoadError(true)
        }),
    [fetchFn]
  )
  useEffect(() => {
    reload()
    getMyCreatorPoolImpact()
      .then(setPool)
      .catch(() => {})
  }, [reload])

  const amountNum = Number(amount) || 0
  const amountError =
    amountNum < 400
      ? "Minimum payout is ₹400."
      : data && amountNum * 100 > data.available
        ? `You have ${rs(data.available)} available.`
        : ""

  const submit = async () => {
    setBusy(true)
    try {
      await payoutFn({
        data: methodId
          ? { amountPaise: amountNum * 100, payout_method_id: methodId }
          : { amountPaise: amountNum * 100, destination },
      })
      toast.success(
        "Payout requested. We'll process it within 3 business days."
      )
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const onMethods = useCallback((m: MaskedPayoutMethod[]) => {
    setMethods(m)
    setMethodId(
      (cur) => cur || m.find((x) => x.is_default)?.id || m[0]?.id || ""
    )
  }, [])

  const redeem = async () => {
    setRedeeming(true)
    try {
      const res = await redeemStudioFromEarnings()
      const d = new Date(res.studioUntil).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
      toast.success(`Studio paid from earnings, active until ${d}.`)
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setRedeeming(false)
    }
  }

  if (!data && loadError)
    return (
      <div className="mx-auto w-full max-w-350 px-4 py-6 sm:px-6 md:px-8 md:py-8">
        <h1 className="font-display text-3xl text-foreground">Earnings</h1>
        <div className="surface mt-8 rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load your earnings.
          </p>
          <Button
            variant="outline"
            className="mt-4 min-h-11"
            onClick={() => reload()}
          >
            Try again
          </Button>
        </div>
      </div>
    )
  if (!data)
    return (
      <div className="mx-auto w-full max-w-350 px-4 py-6 sm:px-6 md:px-8 md:py-8">
        <StudioSkeleton />
      </div>
    )

  // Earnings and payouts in one list, newest first.
  const activity = [
    ...data.ledger.slice(0, 20).map((r, i) => {
      const src = SOURCE[r.source] ?? {
        label: r.source.replace(/_/g, " "),
        icon: Coins,
      }
      const status =
        r.status === "reversed"
          ? "Reversed"
          : r.net_paise < 0
            ? "Deducted"
            : now - new Date(r.created_at).getTime() < HOLD_MS
              ? "Clearing"
              : "Available"
      return {
        key: "l" + i,
        at: r.created_at,
        label: src.label,
        icon: src.icon,
        status,
        amount: r.net_paise,
      }
    }),
    ...data.payouts.map((p) => ({
      key: "p" + p.id,
      at: p.created_at,
      label: "Payout",
      icon: ArrowUpRight,
      status: PAYOUT_STATUS[p.status] ?? "Processing",
      amount: -p.amount_paise,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <div className="mx-auto w-full max-w-350 space-y-8 px-4 py-6 sm:px-6 md:px-8 md:py-8">
      <header>
        <h1 className="font-display text-3xl text-foreground">Earnings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tips, memberships and sales, after fees. Insight points are status,
          not money.
        </p>
      </header>
      <LaunchPaymentsNotice />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={Wallet}
          label="Available"
          value={rs(data.available)}
          sub={data.held > 0 ? `${rs(data.held)} clearing, 7 days` : undefined}
        />
        <Stat
          icon={TrendingUp}
          label="Lifetime net"
          value={rs(data.lifetimeNet)}
        />
        <Stat icon={Coins} label="Paid out" value={rs(data.paidOut)} />
        <Stat
          icon={Sparkles}
          label="Insight points"
          value={formatCompactNumber(data.points)}
        />
      </div>

      {pool && pool.periodEnd && pool.members > 0 && (
        <section className="surface rounded-lg p-4 sm:p-6">
          <h2 className="mb-1 font-display text-xl text-foreground">
            Reader Pass support
          </h2>
          <p className="text-sm text-muted-foreground">
            Last month{" "}
            <strong className="text-foreground">{rs(pool.total)}</strong> came
            from{" "}
            <strong className="text-foreground">
              {pool.members} Reader Pass{" "}
              {pool.members === 1 ? "member" : "members"}
            </strong>{" "}
            who clapped for your work: their subscription, directed to you.
          </p>
        </section>
      )}

      {!launchFree && <PayoutMethods onChange={onMethods} />}

      {launchFree ? (
        <section className="surface rounded-lg p-4 sm:p-6">
          <h2 className="mb-1 font-display text-xl text-foreground">Payouts</h2>
          <p className="text-sm text-muted-foreground">
            Payouts open after launch. Your earnings keep adding up here until
            then.
          </p>
        </section>
      ) : (
        <section className="surface rounded-lg p-4 sm:p-6">
          <h2 className="mb-1 font-display text-xl text-foreground">
            Request payout
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Minimum ₹400, so fees don&apos;t eat your earnings. We pay within 3
            business days.
          </p>
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-40">
              <Label htmlFor="payout-amount">Amount (₹)</Label>
              <Input
                id="payout-amount"
                type="number"
                inputMode="numeric"
                min={400}
                step={100}
                className="mt-2 min-h-11"
                value={amount}
                aria-invalid={!!amountError}
                aria-describedby={
                  amountError ? "payout-amount-error" : undefined
                }
                onChange={(e) => setAmount(e.target.value)}
              />
              {amountError && (
                <p
                  id="payout-amount-error"
                  className="mt-1 text-sm text-destructive"
                >
                  {amountError}
                </p>
              )}
            </div>
            {methods.length > 0 ? (
              <PayoutMethodPicker
                methods={methods}
                value={methodId}
                onChange={setMethodId}
              />
            ) : (
              <div className="min-w-50 flex-1">
                <Label htmlFor="payout-destination">
                  UPI ID or bank account
                </Label>
                <Input
                  id="payout-destination"
                  className="mt-2 min-h-11"
                  placeholder="you@upi or A/C + IFSC"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
            )}
            <Button
              className="min-h-11 sm:mt-7"
              onClick={submit}
              disabled={
                busy ||
                !!amountError ||
                (methods.length > 0 ? !methodId : !destination.trim())
              }
            >
              {busy ? "Requesting…" : "Request payout"}
            </Button>
          </div>
        </section>
      )}

      {!launchFree && data.available >= 49900 && (
        <section className="surface rounded-lg p-4 sm:p-6">
          <h2 className="mb-1 font-display text-xl text-foreground">
            Pay Studio from earnings
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Use <strong className="text-foreground">₹499</strong> of your
            available earnings for one month of Studio instead of your card. It
            adds to any Studio time you already have.
          </p>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={redeem}
            disabled={redeeming}
          >
            {redeeming ? "Applying…" : "Apply ₹499 to Studio (1 month)"}
          </Button>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-xl text-foreground">
          Recent activity
        </h2>
        {activity.length === 0 ? (
          <p className="surface rounded-lg px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing yet. Your earnings and payouts will show up here.
          </p>
        ) : (
          <ul className="surface divide-y divide-border rounded-lg">
            {activity.map((a) => {
              const Icon = a.icon
              return (
                <li
                  key={a.key}
                  className="flex min-h-14 items-center gap-3 px-4 py-3 text-sm"
                >
                  <Icon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-foreground">
                      {a.label}
                    </span>
                    <span className="block text-muted-foreground">
                      {day(a.at)}
                    </span>
                    <Badge
                      variant={
                        a.status === "Available" || a.status === "Paid"
                          ? "secondary"
                          : "outline"
                      }
                      className="mt-1 font-normal sm:hidden"
                    >
                      {a.status}
                    </Badge>
                  </span>
                  <Badge
                    variant={
                      a.status === "Available" || a.status === "Paid"
                        ? "secondary"
                        : "outline"
                    }
                    className="hidden shrink-0 font-normal sm:inline-flex"
                  >
                    {a.status}
                  </Badge>
                  <span
                    className={`w-16 shrink-0 text-right tabular-nums sm:w-20 ${a.amount < 0 ? "text-muted-foreground" : "text-foreground"}`}
                  >
                    {a.amount < 0 ? "−" : ""}
                    {rs(Math.abs(a.amount))}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Wallet
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="surface flex flex-col gap-2 rounded-lg p-4">
      <span className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        {label}
        <Icon className="size-4 shrink-0" aria-hidden />
      </span>
      <span className="font-display text-2xl text-foreground tabular-nums">
        {value}
      </span>
      {sub && <span className="text-sm text-muted-foreground">{sub}</span>}
    </div>
  )
}
