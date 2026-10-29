"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  actionDmcaNotice,
  reopenDmcaNotice,
  resolveNoticeTarget,
  restoreFromCounterNotice,
} from "@/actions/dmca"
import { formatRelativeTime } from "@/lib/utils"

const NOTICE_STATUSES = ["received", "actioned", "rejected"] as const

export type DmcaNotice = {
  id: string
  notice_type: string
  status: string
  created_at: string
  complainant_name: string
  work_identification: string
  infringing_urls: string[]
  piece: { title: string; slug: string | null; status: string; author_handle: string | null } | null
}
export type DmcaCounter = {
  id: string
  notice_id: string
  status: string
  restore_eligible_at: string
  created_at: string
  piece_title: string | null
}

export function DmcaQueue({
  notices,
  counters,
  activeStatus = "received",
}: {
  notices: DmcaNotice[]
  counters: DmcaCounter[]
  activeStatus?: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})

  const run = (id: string, fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => {
    setBusy(id)
    start(async () => {
      try {
        const res = await fn()
        if (res.success) toast.success(ok)
        else toast.error(res.error || "Action failed")
      } catch (e) {
        toast.error((e as Error).message)
      } finally {
        setBusy(null)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 font-display text-xl tracking-tight">Copyright / grievance notices</h2>
        <div className="mb-3 flex gap-3 text-sm">
          {NOTICE_STATUSES.map((s) => (
            <Link
              key={s}
              href={`?dmca=${s}`}
              scroll={false}
              className={
                activeStatus === s
                  ? "font-medium text-foreground underline"
                  : "text-muted-foreground hover:text-foreground"
              }
            >
              {s}
            </Link>
          ))}
        </div>
        {notices.length === 0 ? (
          <div className="hairline rounded-lg px-4 py-10 text-center text-sm text-muted-foreground">
            No {activeStatus} notices.
          </div>
        ) : (
          <div className="hairline divide-y divide-border overflow-hidden rounded-lg">
            {notices.map((n) => {
              const b = pending && busy === n.id
              return (
                <div key={n.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {n.piece?.title ?? "Unknown piece"}
                      {n.piece?.author_handle && (
                        <span className="text-muted-foreground"> by @{n.piece.author_handle}</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {n.work_identification} · from {n.complainant_name} ·{" "}
                      {formatRelativeTime(n.created_at)}
                    </p>
                  </div>
                  <Badge variant="outline">{n.notice_type}</Badge>
                  {n.status === "received" && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {!n.piece && (
                        <>
                          <Input
                            value={urls[n.id] ?? ""}
                            onChange={(e) => setUrls((u) => ({ ...u, [n.id]: e.target.value }))}
                            placeholder="Paste the reported URL to match a piece"
                            className="h-8 w-64"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={b || !(urls[n.id] ?? "").trim()}
                            onClick={() =>
                              run(n.id, () => resolveNoticeTarget({ id: n.id, url: urls[n.id] }), "Piece matched")
                            }
                          >
                            Match
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={b}
                        onClick={() => run(n.id, () => actionDmcaNotice({ id: n.id, decision: "reject" }), "Notice rejected")}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={b || !n.piece}
                        title={n.piece ? undefined : "Match the reported URL to a piece first"}
                        onClick={() => run(n.id, () => actionDmcaNotice({ id: n.id, decision: "disable" }), "Content disabled")}
                      >
                        Disable
                      </Button>
                    </div>
                  )}
                  {n.status === "rejected" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={b}
                      onClick={() => run(n.id, () => reopenDmcaNotice({ id: n.id }), "Notice reopened")}
                    >
                      Reopen
                    </Button>
                  )}
                  {n.status === "actioned" && <Badge variant="secondary">actioned</Badge>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 font-display text-xl tracking-tight">Counter-notices</h2>
        {counters.length === 0 ? (
          <div className="hairline rounded-lg px-4 py-10 text-center text-sm text-muted-foreground">
            No pending counter-notices.
          </div>
        ) : (
          <div className="hairline divide-y divide-border overflow-hidden rounded-lg">
            {counters.map((c) => {
              const b = pending && busy === c.id
              const eligible = new Date() >= new Date(c.restore_eligible_at)
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{c.piece_title ?? "Unknown piece"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {eligible
                        ? "Eligible to restore now"
                        : `Eligible to restore ${new Date(c.restore_eligible_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={b || !eligible}
                    onClick={() => run(c.id, () => restoreFromCounterNotice({ counterNoticeId: c.id }), "Content restored")}
                  >
                    Restore
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
