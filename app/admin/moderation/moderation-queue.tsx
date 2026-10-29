"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { dismissReport, takedownContent, restoreContent } from "@/actions/moderation"
import { formatRelativeTime } from "@/lib/utils"

export type ModerationReport = {
  id: string
  content_object_id: string | null
  user_id: string | null
  reason: string
  status: string
  created_at: string
  target_type: string | null
  target_id: string | null
  piece: {
    title: string
    slug: string | null
    status: string
    author_handle: string | null
  } | null
}

export function ModerationQueue({ reports }: { reports: ModerationReport[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  const run = (
    reportId: string,
    fn: () => Promise<{ success: boolean; error?: string }>,
    ok: string
  ) => {
    setBusyId(reportId)
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

  if (reports.length === 0) {
    return (
      <div className="hairline rounded-lg px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">No pending reports. All clear.</p>
      </div>
    )
  }

  return (
    <div className="hairline divide-y divide-border overflow-hidden rounded-lg">
      {reports.map((r) => {
        const busy = pending && busyId === r.id
        return (
          <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                {r.piece ? (
                  <Link
                    href={`/u/${r.piece.author_handle ?? "_"}/${r.piece.slug ?? ""}`}
                    className="font-medium hover:underline"
                  >
                    {r.piece.title}
                  </Link>
                ) : (
                  <span className="font-medium">Unknown content</span>
                )}
                {r.piece?.author_handle && (
                  <span className="text-muted-foreground"> by @{r.piece.author_handle}</span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {r.reason} · {formatRelativeTime(r.created_at)}
              </p>
            </div>
            <Badge variant="outline">{r.target_type ?? "piece"}</Badge>
            {r.piece && r.piece.status !== "published" && (
              <Badge variant="secondary">{r.piece.status}</Badge>
            )}
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => run(r.id, () => dismissReport({ reportId: r.id }), "Report dismissed")}
              >
                Dismiss
              </Button>
              {r.content_object_id &&
                (r.piece?.status === "published" ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(
                          r.id,
                          () =>
                            takedownContent({
                              reportId: r.id,
                              contentObjectId: r.content_object_id!,
                              action: "archived",
                            }),
                          "Content archived"
                        )
                      }
                    >
                      Archive
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() =>
                        run(
                          r.id,
                          () =>
                            takedownContent({
                              reportId: r.id,
                              contentObjectId: r.content_object_id!,
                              action: "deleted",
                            }),
                          "Content deleted"
                        )
                      }
                    >
                      Delete
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      run(
                        r.id,
                        () => restoreContent({ contentObjectId: r.content_object_id! }),
                        "Content restored"
                      )
                    }
                  >
                    Restore
                  </Button>
                ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
