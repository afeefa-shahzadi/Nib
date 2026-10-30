"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  getMyRestriction,
  submitAppeal,
  type MyRestriction,
} from "@/actions/restrictions"

// Shown across Studio while the creator is restricted. Self-fetches; renders
// nothing when the account is clear, so it's safe to mount unconditionally.
// `initial` comes from the studio layout (server); without it, self-fetch.
export function RestrictionBanner({ initial }: { initial?: MyRestriction } = {}) {
  const [r, setR] = useState<MyRestriction | null>(initial ?? null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (initial) return
    getMyRestriction()
      .then(setR)
      .catch(() => {})
  }, [initial])

  if (!r || !r.restricted) return null

  const until =
    r.permanent || !r.until
      ? null
      : new Date(r.until).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })

  const appeal = async () => {
    setBusy(true)
    try {
      await submitAppeal({ data: { reason } })
      toast.success("Appeal submitted — we'll review it.")
      setR({ ...r, appealPending: true })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-350 px-6 pt-6 md:px-8">
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertTriangle className="size-4" />
          {r.permanent
            ? "Your account is restricted"
            : `Publishing and payouts are paused until ${until}`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {r.reason ?? "A piece was removed for a policy violation."}
        </p>

        {r.appealPending ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Your appeal is under review.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            <Textarea
              placeholder="Explain why this restriction should be lifted…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <Button size="sm" onClick={appeal} disabled={busy || !reason.trim()}>
              {busy ? "Submitting…" : "Submit appeal"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
