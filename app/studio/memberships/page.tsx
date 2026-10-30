"use client"
import { StudioSkeleton } from "@/components/studio/studio-skeleton"
import { useQuery } from "@tanstack/react-query"
import { listMyMemberships, cancelMyMembership } from "@/actions/memberships"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { toast } from "sonner"
import Link from "next/link"

const STATUS: Record<string, string> = {
  active: "Active",
  canceled: "Canceled",
  past_due: "Payment due",
  expired: "Expired",
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

export default function MembershipsPage() {
  const q = useQuery({
    queryKey: ["my-memberships"],
    queryFn: () => listMyMemberships(),
  })

  async function cancel(id: string) {
    const r = await cancelMyMembership({ data: { membership_id: id } })
    if ("error" in r) {
      toast.error(r.error)
      return
    }
    toast.success(
      r.endsAt
        ? `Membership canceled. You keep access until ${day(r.endsAt)}.`
        : "Membership canceled."
    )
    q.refetch()
  }

  if (q.isLoading) return <StudioSkeleton />

  const memberships = [...(q.data?.memberships ?? [])].sort(
    (a, b) => Number(b.status === "active") - Number(a.status === "active")
  )
  const active = memberships.filter((m) => m.status === "active").length

  return (
    <div className="mx-auto w-full max-w-350 px-4 py-6 sm:px-6 md:px-8 md:py-8">
      <h1 className="font-display text-3xl text-foreground">Memberships</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Writers you support. {active} active.
      </p>

      {q.isError ? (
        <div className="surface rounded-lg p-6 text-center">
          <p className="font-medium text-foreground">
            Couldn&apos;t load your memberships
          </p>
          <Button
            variant="outline"
            className="mt-4 min-h-11"
            onClick={() => q.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : memberships.length === 0 ? (
        <div className="surface flex flex-col items-center gap-2 rounded-lg p-8 text-center sm:p-12">
          <h2 className="font-display text-xl text-foreground">
            You don&apos;t support any writers yet
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Join a writer&apos;s membership from their profile to back their
            work each month.
          </p>
          <Button asChild variant="outline" className="mt-4 min-h-11">
            <Link href="/feed">Explore the feed</Link>
          </Button>
        </div>
      ) : (
        <ul className="surface divide-y divide-border rounded-lg">
          {memberships.map((m) => {
            const isActive = m.status === "active"
            const rupees = Math.round((m.tier?.price_cents ?? 0) / 100)
            const name = m.author?.display_name ?? "Writer"
            return (
              <li
                key={m.id}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <p className="font-display text-lg break-words text-foreground">
                      {name}
                    </p>
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      className="font-normal"
                    >
                      {m.ending ? "Ending" : (STATUS[m.status] ?? m.status)}
                    </Badge>
                  </div>
                  {m.author?.handle && (
                    <Link
                      href={`/u/${m.author.handle}`}
                      className="-my-2 inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground"
                    >
                      @{m.author.handle}
                    </Link>
                  )}
                  <p className="text-sm text-foreground">
                    {rupees === 0 ? "Free" : `₹${rupees} / month`}
                    <span className="text-muted-foreground">
                      {" "}
                      · {m.tier?.name ?? "Tier"}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Member since {day(m.started_at)}
                    {isActive && m.period_end && (
                      <>
                        {" · "}
                        {m.ending ? "Access ends" : "Renews"}{" "}
                        {day(m.period_end)}
                      </>
                    )}
                  </p>
                </div>
                {isActive && !m.ending && (
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant="outline"
                        className="min-h-11 self-start sm:self-center"
                      >
                        Cancel membership
                      </Button>
                    }
                    title={`Cancel your membership with ${name}?`}
                    description={
                      m.period_end
                        ? `You keep access until ${day(m.period_end)}, then it stops. You won't be charged again.`
                        : "Your access stops now. You won't be charged again."
                    }
                    destructive
                    confirmLabel="Cancel membership"
                    cancelLabel="Keep membership"
                    onConfirm={() => cancel(m.id)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
