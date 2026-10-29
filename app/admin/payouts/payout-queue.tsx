"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  settlePayout,
  disbursePayout,
  type PendingPayout,
} from "@/actions/admin/payouts"
import { tdsOnPayoutPaise } from "@/lib/tax"
import { formatRelativeTime } from "@/lib/utils"

function rs(p: number | null) {
  return `₹${((p ?? 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}

export function PayoutQueue({
  payouts,
  rzxConfigured = false,
}: {
  payouts: PendingPayout[]
  rzxConfigured?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [refs, setRefs] = useState<Record<string, string>>({})

  const run = (
    id: string,
    fn: () => Promise<{ success: boolean; error?: string }>,
    ok: string
  ) => {
    setBusyId(id)
    startTransition(async () => {
      try {
        const res = await fn()
        if (res.success) toast.success(ok)
        else toast.error(res.error || "Action failed")
      } catch (e) {
        toast.error((e as Error).message)
      } finally {
        setBusyId(null)
        router.refresh()
      }
    })
  }

  if (payouts.length === 0) {
    return (
      <div className="hairline rounded-lg px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">No pending payouts.</p>
      </div>
    )
  }

  return (
    <div className="hairline divide-y divide-border overflow-hidden rounded-lg">
      {payouts.map((p) => {
        const busy = pending && busyId === p.id
        return (
          <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {rs(p.amount_paise)}
                {p.handle && (
                  <span className="text-muted-foreground"> · @{p.handle}</span>
                )}
              </p>
              <p className="mt-0.5 text-xs break-all text-muted-foreground">
                {p.destination || "no destination"} ·{" "}
                {p.created_at ? formatRelativeTime(p.created_at) : "—"}
              </p>
              {(() => {
                const tds = tdsOnPayoutPaise(p.amount_paise ?? 0)
                return (
                  <p className="mt-0.5 text-xs font-medium text-primary">
                    Send {rs((p.amount_paise ?? 0) - tds)} · {rs(tds)} TDS withheld
                  </p>
                )
              })()}
            </div>
            <Input
              className="max-w-45"
              placeholder="UTR / txn ref"
              value={refs[p.id] ?? ""}
              onChange={(e) =>
                setRefs((m) => ({ ...m, [p.id]: e.target.value }))
              }
            />
            <div className="flex items-center gap-1.5">
              {p.status === "processing" && (
                <Badge variant="secondary">disbursing</Badge>
              )}
              {rzxConfigured && p.status === "requested" && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    run(p.id, () => disbursePayout({ data: { id: p.id } }), "Disbursing via RazorpayX")
                  }
                >
                  Approve &amp; disburse
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(
                    p.id,
                    () =>
                      settlePayout({
                        data: {
                          id: p.id,
                          status: "paid",
                          reference: refs[p.id],
                        },
                      }),
                    "Marked paid"
                  )
                }
              >
                Mark paid
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  const reason =
                    typeof window !== "undefined"
                      ? window.prompt("Failure reason (optional)") ?? ""
                      : ""
                  run(
                    p.id,
                    () =>
                      settlePayout({
                        data: {
                          id: p.id,
                          status: "failed",
                          failureReason: reason,
                        },
                      }),
                    "Marked failed — funds returned"
                  )
                }}
              >
                Mark failed
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
