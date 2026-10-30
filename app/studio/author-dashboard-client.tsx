"use client"

import { useRouter } from "next/navigation"
import { createPiece } from "@/actions/content"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  FileText,
  FilePen,
  Users,
  IndianRupee,
  MessagesSquare,
  GitBranch,
  Package,
  Network,
  Heart,
  ShoppingBag,
  UserPlus,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { LeaderboardRankCard } from "@/components/leaderboard-rank-card"
import Link from "next/link"
import { useState, type ReactNode } from "react"
import { AuthorStats, AuthorActivity } from "@/lib/types/content"
import { formatCompactNumber } from "@/lib/utils"

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}

const day = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })

const count = (n: number | null | undefined) => (n != null ? formatCompactNumber(n) : "—")

function StatusBadge({ status }: { status: string }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <Badge variant={status === "published" ? "secondary" : "outline"} className="shrink-0 font-normal">
      {label}
    </Badge>
  )
}

function ActivityIcon({ kind }: { kind: string }) {
  const cls = "size-4 text-muted-foreground"
  switch (kind) {
    case "supporter":
      return <UserPlus className={cls} aria-hidden />
    case "tip":
      return <Heart className={cls} aria-hidden />
    case "bundle":
      return <Package className={cls} aria-hidden />
    default:
      return <ShoppingBag className={cls} aria-hidden />
  }
}

export function AuthorDashboardClient({
  stats,
  activity,
  name,
  checklist,
}: {
  stats: AuthorStats | null
  activity: AuthorActivity | null
  name?: string | null
  checklist?: ReactNode
}) {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)

  const onNew = async () => {
    try {
      setIsCreating(true)
      const p = await createPiece({ data: { title: "Untitled piece" } })
      router.push("/studio/drafts/" + p.id)
    } catch (e) {
      toast.error((e as Error).message)
      setIsCreating(false)
    }
  }

  const kpis = [
    { label: "Revenue, last 30 days", value: stats ? rupees(stats.revenue30dPaise) : "—", icon: IndianRupee, href: "/studio/analytics" },
    { label: "Active supporters", value: count(stats?.supporters), icon: Users, href: "/studio/tiers" },
    { label: "Published", value: count(stats?.published), icon: FileText, href: "/studio/drafts" },
    { label: "Drafts", value: count(stats?.drafts), icon: FilePen, href: "/studio/drafts" },
  ]

  const work = [
    { label: "Branches", value: count(stats?.branches), icon: GitBranch, href: "/studio/branches" },
    { label: "Bundles", value: count(stats?.bundles), icon: Package, href: "/studio/bundles" },
    { label: "Debate rooms", value: count(stats?.debateRooms), icon: MessagesSquare, href: "/studio/debates" },
    { label: "Content graph", value: null, icon: Network, href: "/studio/graph" },
  ]

  // Supporters and sales in one list, newest first.
  const money = [
    ...(activity?.subs ?? []).map((s) => ({ id: "s" + s.id, kind: "supporter", label: "New supporter", amount: null as number | null, at: s.started_at })),
    ...(activity?.purchases ?? []).map((p) => ({
      id: "p" + p.id,
      kind: p.kind,
      label: p.kind === "tip" ? "Tip received" : p.kind === "bundle" ? "Bundle sold" : "Sale",
      amount: p.amount_paise,
      at: p.created_at,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  return (
    <div className="mx-auto w-full max-w-350 px-4 py-6 sm:px-6 md:px-8 md:py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground" suppressHydrationWarning>
            {greeting}{name ? `, ${name.split(" ")[0]}` : ""}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="min-h-11" asChild>
            <Link href="/studio/drafts">All pieces</Link>
          </Button>
          <Button className="min-h-11" onClick={onNew} disabled={isCreating}>
            <Plus className="size-4" aria-hidden />
            {isCreating ? "Creating…" : "New piece"}
          </Button>
        </div>
      </div>

      {checklist}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((c) => {
          const Icon = c.icon
          return (
            <Link
              key={c.label}
              href={c.href}
              className="surface flex flex-col gap-2 rounded-lg p-4 transition-colors hover:border-primary/50"
            >
              <span className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                {c.label}
                <Icon className="size-4 shrink-0" aria-hidden />
              </span>
              <span className="font-display text-2xl text-foreground tabular-nums">{c.value}</span>
            </Link>
          )
        })}
      </div>

      <section aria-labelledby="your-work" className="mb-8">
        <h2 id="your-work" className="sr-only">Your work</h2>
        <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 lg:grid-cols-4">
          {work.map((w) => {
            const Icon = w.icon
            return (
              <Link
                key={w.label}
                href={w.href}
                className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-accent/40"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-foreground">{w.label}</span>
                {w.value != null ? (
                  <span className="tabular-nums text-muted-foreground">{w.value}</span>
                ) : (
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                )}
              </Link>
            )
          })}
        </div>
      </section>

      <div className="mb-8">
        <LeaderboardRankCard audience="author" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl text-foreground">Recent pieces</h2>
            <Link href="/studio/drafts" className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">
              See all
            </Link>
          </div>
          <div className="surface divide-y divide-border rounded-lg">
            {(activity?.pieces ?? []).map((p) => (
              <Link
                key={p.id}
                href={"/studio/drafts/" + p.id}
                className="flex min-h-12 items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent/40"
              >
                <span className="min-w-0 truncate text-foreground">{p.title || "Untitled piece"}</span>
                <StatusBadge status={p.status} />
              </Link>
            ))}
            {activity && activity.pieces.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                <p className="mb-3">You haven&apos;t written anything yet.</p>
                <Button variant="outline" className="min-h-11" onClick={onNew} disabled={isCreating}>
                  Start your first piece
                </Button>
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 flex min-h-11 items-center font-display text-xl text-foreground">Supporters and sales</h2>
          <div className="surface divide-y divide-border rounded-lg">
            {money.map((m) => (
              <div key={m.id} className="flex min-h-12 items-center gap-3 px-4 py-3 text-sm">
                <ActivityIcon kind={m.kind} />
                <span className="min-w-0 flex-1 text-foreground">
                  {m.label}
                  {m.amount != null && <span className="text-muted-foreground"> · {rupees(m.amount)}</span>}
                </span>
                <span className="shrink-0 text-muted-foreground">{day(m.at)}</span>
              </div>
            ))}
            {activity && money.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No supporters or sales yet. Set up{" "}
                <Link href="/studio/tiers" className="text-foreground underline underline-offset-2">
                  membership tiers
                </Link>{" "}
                to start earning.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
