"use client"

import { useRouter } from "next/navigation"
import { createPiece } from "@/actions/content"
import { Button } from "@/components/ui/button"
import {
  Plus,
  FileText,
  Users,
  IndianRupee,
  MessagesSquare,
  GitBranch,
  Package,
} from "lucide-react"
import { toast } from "sonner"
import { LeaderboardRankCard } from "@/components/leaderboard-rank-card"
import Link from "next/link"
import { useState } from "react"
import { AuthorStats, AuthorActivity } from "@/lib/types/content"
import { formatCompactNumber } from "@/lib/utils"

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}

export function AuthorDashboardClient({
  stats,
  activity,
}: {
  stats: AuthorStats | null
  activity: AuthorActivity | null
}) {
  const router = useRouter()
  const create = createPiece
  const [isCreating, setIsCreating] = useState(false)

  const onNew = async () => {
    try {
      setIsCreating(true)
      const p = await create({ data: { title: "Untitled piece" } })
      router.push("/studio/drafts/" + p.id)
    } catch (e) {
      toast.error((e as Error).message)
      setIsCreating(false)
    }
  }

  const kpis = [
    {
      label: "Revenue (30d)",
      value: stats ? rupees(stats.revenue30dPaise) : "—",
      icon: IndianRupee,
      accent: "text-primary",
      href: "/studio/analytics",
    },
    {
      label: "Active supporters",
      value: stats?.supporters != null ? formatCompactNumber(stats.supporters) : "—",
      icon: Users,
      href: "/studio/tiers",
    },
    {
      label: "Published",
      value: stats?.published != null ? formatCompactNumber(stats.published) : "—",
      icon: FileText,
      href: "/studio/drafts",
    },
    {
      label: "Drafts",
      value: stats?.drafts != null ? formatCompactNumber(stats.drafts) : "—",
      icon: FileText,
      href: "/studio/drafts",
    },
    {
      label: "Branches",
      value: stats?.branches != null ? formatCompactNumber(stats.branches) : "—",
      icon: GitBranch,
      href: "/studio/branches",
    },
    {
      label: "Bundles",
      value: stats?.bundles != null ? formatCompactNumber(stats.bundles) : "—",
      icon: Package,
      href: "/studio/bundles",
    },
    {
      label: "Debate rooms",
      value: stats?.debateRooms != null ? formatCompactNumber(stats.debateRooms) : "—",
      icon: MessagesSquare,
      href: "/studio/debates",
    },
    {
      label: "Content Graph",
      value: "View",
      icon: GitBranch,
      accent: "text-info",
      href: "/studio/graph",
    },
  ]

  return (
    <div className="mx-auto w-full max-w-350 p-6 md:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Studio · Author
          </p>
          <h1 className="font-display text-3xl text-foreground">Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/studio/drafts">All pieces</Link>
          </Button>
          <Button onClick={onNew} disabled={isCreating} aria-label="New piece">
            <Plus className="mr-0 sm:mr-2 size-4" />{" "}
            <span className="hidden sm:block">
              {isCreating ? "Creating..." : "New piece"}
            </span>
          </Button>
        </div>
      </div>

      <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((c) => {
          const Icon = c.icon
          const cardInner = (
            <>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] tracking-wider text-muted-foreground uppercase">
                  {c.label}
                </p>
                <Icon className="size-3.5 text-muted-foreground" />
              </div>
              <p
                className={`font-display text-2xl ${c.accent ?? "text-foreground"}`}
              >
                {c.value}
              </p>
            </>
          )

          return (
            <Link
              key={c.label}
              href={c.href}
              className="surface block rounded-md p-4 transition-all hover:border-primary/50 hover:shadow-sm"
            >
              {cardInner}
            </Link>
          )
        })}
      </div>

      <div className="mb-8">
        <LeaderboardRankCard audience="author" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-xl text-foreground">
            Recent pieces
          </h2>
          <div className="surface divide-y divide-border rounded-md">
            {(activity?.pieces ?? []).map((p) => (
              <Link
                key={p.id}
                href={"/studio/drafts/" + p.id}
                className="block px-5 py-3 transition-colors hover:bg-accent/40"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-foreground">{p.title}</span>
                  <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
                    {p.status}
                  </span>
                </div>
              </Link>
            ))}
            {activity && activity.pieces.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                Nothing yet.{" "}
                <button
                  onClick={onNew}
                  className="text-foreground underline"
                  disabled={isCreating}
                >
                  Start your first piece →
                </button>
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-foreground">
            Recent supporters & sales
          </h2>
          <div className="surface divide-y divide-border rounded-md">
            {(activity?.subs ?? []).slice(0, 5).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <span className="text-foreground">New supporter</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(s.started_at).toLocaleDateString()}
                </span>
              </div>
            ))}
            {(activity?.purchases ?? []).slice(0, 5).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <span className="text-foreground">
                  {p.kind === "tip"
                    ? "Tip received"
                    : p.kind === "bundle"
                      ? "Bundle sold"
                      : "Sale"}
                  <span className="text-muted-foreground">
                    {" "}
                    · {rupees(p.amount_paise)}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString("en-US")}
                </span>
              </div>
            ))}
            {activity &&
              activity.subs.length === 0 &&
              activity.purchases.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No revenue yet — set up{" "}
                  <Link
                    href="/studio/tiers"
                    className="text-foreground underline"
                  >
                    membership tiers
                  </Link>
                  .
                </div>
              )}
          </div>
        </section>
      </div>
    </div>
  )
}
