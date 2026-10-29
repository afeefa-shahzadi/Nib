 
"use client"
import { useQuery } from "@tanstack/react-query"
import { listMyMemberships, cancelMyMembership } from "@/actions/memberships"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { toast } from "sonner"
import { Wallet } from "lucide-react"
import Link from "next/link"

export default function MembershipsPage() {
  const listFn = listMyMemberships
  const cancelFn = cancelMyMembership
  const q = useQuery({ queryKey: ["my-memberships"], queryFn: () => listFn() })

  async function cancel(id: string) {
    try {
      await cancelFn({ data: { membership_id: id } })
      toast.success("Membership canceled")
      q.refetch()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (q.isLoading)
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>
  const memberships = q.data?.memberships ?? []
  const subs = q.data?.subscriptions ?? []
  const subByMembership = new Map(
    subs.map((s) => [`${s.author_id}:${s.tier_id}`, s])
  )

  return (
    <div className="mx-auto w-full max-w-350 p-6 md:p-8">
      <div className="mb-1 flex items-center gap-3">
        <Wallet className="size-5 text-primary" />
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
          Account
        </p>
      </div>
      <h1 className="mb-8 font-display text-3xl text-foreground">
        My memberships
      </h1>

      {memberships.length === 0 ? (
        <div className="surface rounded-md p-10 text-center">
          <p className="text-muted-foreground">
            You haven&apos;t supported any authors yet.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/feed">Explore the feed</Link>
          </Button>
        </div>
      ) : (
        <div className="surface divide-y divide-border rounded-md">
          {memberships.map((m) => {
            const sub = subByMembership.get(`${m.author_id}:${m.tier_id}`)
            const isActive = m.status === "active"
            return (
              <div
                key={m.id}
                className="flex items-start justify-between gap-4 p-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-display text-lg text-foreground">
                      {m.author?.display_name ?? "Author"}
                    </p>
                    {m.author?.handle && (
                      <Link
                        href={`/u/${m.author.handle}`}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        @{m.author.handle}
                      </Link>
                    )}
                    <Badge variant={isActive ? "default" : "secondary"}>
                      {m.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {m.tier?.name ?? "Tier"} · ₹
                    {Math.round((m.tier?.price_cents ?? 0) / 100)}/mo
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Started {new Date(m.started_at).toLocaleDateString()}
                    {sub?.current_period_end && (
                      <>
                        {" "}
                        · Renews{" "}
                        {new Date(sub.current_period_end).toLocaleDateString()}
                      </>
                    )}
                  </p>
                </div>
                {isActive && (
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="sm">
                        Cancel
                      </Button>
                    }
                    title="Cancel this membership?"
                    description="You'll lose access to member-only content at the end of the current period."
                    destructive
                    confirmLabel="Cancel membership"
                    onConfirm={() => cancel(m.id)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
