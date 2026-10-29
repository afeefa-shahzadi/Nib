"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { resolveAppeal, type PendingAppeal } from "@/actions/moderation"
import { formatRelativeTime } from "@/lib/utils"

export function AppealsQueue({ appeals }: { appeals: PendingAppeal[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  const run = (id: string, decision: "lift" | "deny", ok: string) => {
    setBusyId(id)
    startTransition(async () => {
      try {
        const res = await resolveAppeal({ data: { id, decision } })
        if (res.success) toast.success(ok)
      } catch (e) {
        toast.error((e as Error).message)
      } finally {
        setBusyId(null)
        router.refresh()
      }
    })
  }

  if (appeals.length === 0) {
    return (
      <div className="hairline rounded-lg px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">No pending appeals.</p>
      </div>
    )
  }

  return (
    <div className="hairline divide-y divide-border overflow-hidden rounded-lg">
      {appeals.map((a) => {
        const busy = pending && busyId === a.id
        const permanent = a.restricted_until === "infinity"
        return (
          <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {a.handle ? `@${a.handle}` : "Unknown user"}
                <span className="text-muted-foreground">
                  {" "}
                  · {a.strikes ?? 0} strike{a.strikes === 1 ? "" : "s"}
                </span>
              </p>
              <p className="mt-0.5 text-xs break-words text-muted-foreground">
                {a.reason} · {a.created_at ? formatRelativeTime(a.created_at) : "—"}
              </p>
            </div>
            <Badge variant={permanent ? "destructive" : "secondary"}>
              {permanent ? "banned" : "restricted"}
            </Badge>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => run(a.id, "lift", "Restriction lifted")}
              >
                Lift
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => run(a.id, "deny", "Appeal denied")}
              >
                Deny
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
