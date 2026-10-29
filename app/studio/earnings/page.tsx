"use client"

import { useCallback, useEffect, useState } from "react"
import {
  getMyEarnings,
  requestPayout,
  getMyCreatorPoolImpact,
  redeemStudioFromEarnings,
} from "@/actions/monetization"
import { Button } from "@/components/ui/button"
import { LaunchPaymentsNotice } from "@/components/launch-payments-notice"
import { useMyPlan } from "@/hooks/use-my-plan"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Wallet, TrendingUp, Coins, Sparkles } from "lucide-react"
import { formatCompactNumber } from "@/lib/utils"
import { PayoutMethods, PayoutMethodPicker } from "./payout-methods"
import type { MaskedPayoutMethod } from "@/actions/monetization/payout-methods"

type Data = Awaited<ReturnType<typeof getMyEarnings>>

function rs(p: number) {
  return `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}

export default function EarningsPage() {
  const fetchFn = getMyEarnings
  const payoutFn = requestPayout
  const [data, setData] = useState<Data | null>(null)
  const [pool, setPool] = useState<Awaited<
    ReturnType<typeof getMyCreatorPoolImpact>
  > | null>(null)
  const [amount, setAmount] = useState(400)
  const [destination, setDestination] = useState("")
  const [methods, setMethods] = useState<MaskedPayoutMethod[]>([])
  const [methodId, setMethodId] = useState("")
  const [busy, setBusy] = useState(false)
  const { launchFree } = useMyPlan()
  const [redeeming, setRedeeming] = useState(false)

  const reload = useCallback(
    () =>
      fetchFn()
        .then(setData)
        .catch(() => {}),
    [fetchFn]
  )
  useEffect(() => {
    reload()
    getMyCreatorPoolImpact()
      .then(setPool)
      .catch(() => {})
  }, [reload])

  const submit = async () => {
    setBusy(true)
    try {
      await payoutFn({
        data: methodId
          ? { amountPaise: amount * 100, payout_method_id: methodId }
          : { amountPaise: amount * 100, destination },
      })
      toast.success("Payout requested. We'll process within 3 business days.")
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const onMethods = useCallback((m: MaskedPayoutMethod[]) => {
    setMethods(m)
    setMethodId((cur) => cur || m.find((x) => x.is_default)?.id || m[0]?.id || "")
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
      toast.success(`Studio paid from earnings — active until ${d}.`)
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setRedeeming(false)
    }
  }

  if (!data)
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>

  return (
    <div className="mx-auto w-full max-w-350 space-y-6 p-6 md:p-8">
      <header>
        <h1 className="font-display text-3xl">Earnings</h1>
        <p className="text-sm text-muted-foreground">
          Tips, sponsorships, and insight points.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Insight Points are status points, not currency. Minimum payout <strong className="text-foreground">₹400</strong>.
        </p>
      </header>
      <LaunchPaymentsNotice />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          icon={<Wallet className="size-4" />}
          label="Available"
          value={rs(data.available)}
          sub={data.held > 0 ? `${rs(data.held)} clearing (7 days)` : undefined}
          accent
        />
        <Stat
          icon={<TrendingUp className="size-4" />}
          label="Lifetime net"
          value={rs(data.lifetimeNet)}
        />
        <Stat
          icon={<Coins className="size-4" />}
          label="Paid out"
          value={rs(data.paidOut)}
        />
        <Stat
          icon={<Sparkles className="size-4" />}
          label="Insight points"
          value={formatCompactNumber(data.points)}
        />
      </div>

      {pool && pool.periodEnd && pool.members > 0 && (
        <section className="surface rounded-md p-5">
          <h2 className="mb-1 font-display text-lg">Reader Pass support</h2>
          <p className="text-sm text-muted-foreground">
            Last month{" "}
            <strong className="text-foreground">{rs(pool.total)}</strong> came
            from{" "}
            <strong className="text-foreground">
              {pool.members} Reader Pass{" "}
              {pool.members === 1 ? "member" : "members"}
            </strong>{" "}
            who clapped for your work — their subscription, directed to you.
          </p>
        </section>
      )}

      {!launchFree && <PayoutMethods onChange={onMethods} />}

      {launchFree ? (
        <section className="surface rounded-md p-5">
          <h2 className="mb-2 font-display text-lg">Payouts</h2>
          <p className="text-sm text-muted-foreground">
            Payouts open after launch. Your earnings keep accruing here until then.
          </p>
        </section>
      ) : (
        <section className="surface rounded-md p-5">
          <h2 className="mb-3 font-display text-lg">Request payout</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Minimum ₹400 to avoid fees eating your earnings.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="max-w-40 flex-1">
              <Label htmlFor="payout-amount" className="text-xs">Amount (₹)</Label>
              <Input
                id="payout-amount"
                type="number"
                min={400}
                step={100}
                value={amount}
                onChange={(e) =>
                  setAmount(Math.max(400, Number(e.target.value) || 400))
                }
              />
            </div>
            {methods.length > 0 ? (
              <PayoutMethodPicker methods={methods} value={methodId} onChange={setMethodId} />
            ) : (
              <div className="min-w-50 flex-1">
                <Label className="text-xs">UPI ID or bank account</Label>
                <Input
                  placeholder="you@upi or A/C + IFSC"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
            )}
            <Button
              onClick={submit}
              disabled={
                busy ||
                data.available < 40000 ||
                (methods.length > 0 ? !methodId : !destination.trim())
              }
            >
              {busy ? "Requesting…" : "Request payout"}
            </Button>
          </div>
          {data.available < 40000 && (
            <p className="mt-2 text-xs text-muted-foreground">
              You need ₹400 available to cash out.
            </p>
          )}
        </section>
      )}

      {!launchFree && data.available >= 49900 && (
        <section className="surface rounded-md p-5">
          <h2 className="mb-1 font-display text-lg">Pay Studio from earnings</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Use <strong className="text-foreground">₹499</strong> of your
            available earnings for one month of Studio instead of your card. Your
            balance stays cash — this just spends ₹499 of it, and stacks on any
            time you already have.
          </p>
          <Button size="sm" variant="outline" onClick={redeem} disabled={redeeming}>
            {redeeming ? "Applying…" : "Apply ₹499 to Studio (1 month)"}
          </Button>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg">Recent activity</h2>
        {data.ledger.length === 0 && data.payouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing yet — your earnings will appear here.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.ledger.slice(0, 20).map((r, i) => (
              <li
                key={i}
                className="surface flex items-center justify-between rounded-md px-4 py-2 text-sm"
              >
                <span className="capitalize">{r.source.replace("_", " ")}</span>
                <span className="text-foreground/80">{rs(r.net_paise)}</span>
              </li>
            ))}
            {data.payouts.map((p) => (
              <li
                key={p.id}
                className="surface flex items-center justify-between rounded-md px-4 py-2 text-sm"
              >
                <span>Payout · {p.status}</span>
                <span>−{rs(p.amount_paise)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
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
      <div className="mt-1 font-display text-2xl">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}
