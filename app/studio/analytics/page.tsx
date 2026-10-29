"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo, useState, useEffect, useRef, type ReactNode } from "react"
import { TrendingUp, Eye, IndianRupee, Activity, Lock } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useMyPlan } from "@/hooks/use-my-plan"
import { hasStudioAccess } from "@/lib/plan"
import { getStudioStats, getRecentActivity } from "@/actions/content"
import { getAuthorTelemetry } from "@/actions/telemetry"
import { getAuthorCohorts } from "@/actions/cohorts"
import { MODE_COLOR } from "@/lib/content/studio/data"
import { KpiGrid } from "./components/kpi-grid"
import dynamic from "next/dynamic"
import { formatCompactNumber } from "@/lib/utils"

// recharts is ~100KB; keep it out of the initial bundle. The skeleton reserves card height (CLS).
const skeleton = (h: number) => function ChartSkeleton() {
  return <div className="surface rounded-md" style={{ height: h }} aria-hidden />
}
const ViewsAreaChart = dynamic(() => import("./components/analytics-charts").then((m) => m.ViewsAreaChart), { ssr: false, loading: skeleton(332) })
const ModePieChart = dynamic(() => import("./components/analytics-charts").then((m) => m.ModePieChart), { ssr: false, loading: skeleton(332) })
const RevenueLineChart = dynamic(() => import("./components/analytics-charts").then((m) => m.RevenueLineChart), { ssr: false, loading: skeleton(312) })
const ReaderFunnelChart = dynamic(() => import("./components/analytics-charts").then((m) => m.ReaderFunnelChart), { ssr: false, loading: skeleton(312) })
const TopPiecesBarChart = dynamic(() => import("./components/analytics-charts").then((m) => m.TopPiecesBarChart), { ssr: false, loading: skeleton(332) })
const CompletionRadialChart = dynamic(() => import("./components/analytics-charts").then((m) => m.CompletionRadialChart), { ssr: false, loading: skeleton(332) })
const CohortMatrixChart = dynamic(() => import("./components/analytics-charts").then((m) => m.CohortMatrixChart), { ssr: false, loading: skeleton(192) })

// Below-the-fold charts mount only when near the viewport; the skeleton keeps their exact height (CLS).
function InView({ height, className, children }: { height: number; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { rootMargin: "200px" })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])
  return (
    <div ref={ref} className={className}>
      {seen ? children : <div className="surface rounded-md" style={{ height }} aria-hidden />}
    </div>
  )
}

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}

export default function AnalyticsPage() {
  const [days, setDays] = useState<number>(30)
  const [mounted, setMounted] = useState(false)
  useEffect(() => queueMicrotask(() => setMounted(true)), [])

  const { plan, loading: planLoading } = useMyPlan()
  const hasStudio = hasStudioAccess(plan)
  const statsFn = getStudioStats
  const actFn = getRecentActivity
  const telFn = getAuthorTelemetry

  const sQ = useQuery({
    queryKey: ["studio-stats", days],
    queryFn: () => statsFn({ data: { days } }),
  })
  const aQ = useQuery({ queryKey: ["studio-activity"], queryFn: () => actFn() })
  const tQ = useQuery({
    queryKey: ["studio-telemetry", days],
    queryFn: () => telFn({ data: { days } }),
  })

  const cohortFn = getAuthorCohorts
  const cQ = useQuery({
    queryKey: ["studio-cohorts"],
    queryFn: () => cohortFn(),
  })

  const published = sQ.data?.published ?? 0
  const supporters = sQ.data?.supporters ?? 0
  const revenue30d = sQ.data?.revenue30dPaise ?? 0
  const revenueDelta = sQ.data?.revenueDelta ?? 0

  const tel = tQ.data
  const totals = useMemo(() => tel?.totals ?? {
    views: 0,
    uniqueViews: 0,
    fullReads: 0,
    depth25: 0,
    depth50: 0,
    depth100: 0,
    modeSwitches: 0,
    shares: 0,
  }, [tel])
  const series = useMemo(() => tel?.series ?? [], [tel])
  const completionPct = totals.views
    ? Math.min(100, Math.round((totals.depth100 / totals.views) * 100))
    : 0
  const readPct = totals.views
    ? Math.min(100, Math.round((totals.depth50 / totals.views) * 100))
    : 0

  // delta vs previous half-window
  const half = Math.floor(series.length / 2)
  const prevViews = series.slice(0, half).reduce((s, d) => s + d.views, 0)
  const lastViews = series.slice(half).reduce((s, d) => s + d.views, 0)
  const viewsDelta = prevViews
    ? Math.round(((lastViews - prevViews) / prevViews) * 100)
    : 0

  // synthesize daily revenue split across the same window so the trend lines up
  const seriesRich = useMemo(() => {
    if (series.length === 0) return []
    const per = Math.round(revenue30d / series.length)
    let cum = 0
    return series.map((d) => {
      cum += per
      return {
        ...d,
        revenue: Math.round(per / 100),
        cumRevenue: Math.round(cum / 100),
      }
    })
  }, [series, revenue30d])

  const modeDist = useMemo(() => (tel?.modes ?? []).map((m) => ({
    name: m.name[0].toUpperCase() + m.name.slice(1),
    value: m.value,
    fill: MODE_COLOR[m.name] ?? "var(--primary)",
  })), [tel])
  const modeDistHasData = modeDist.some((m) => m.value > 0)

  const topPieces = useMemo(() => (tel?.topPieces ?? []).map((p) => ({
    title: p.title.length > 26 ? p.title.slice(0, 24) + "…" : p.title,
    views: p.views,
    reads: p.reads,
  })), [tel])

  const funnel = useMemo(() => [
    { stage: "Views", value: totals.views },
    { stage: "Unique Views", value: totals.uniqueViews ?? 0 },
    {
      stage: "Read 25%",
      value: totals.depth25 ?? 0,
    },
    { stage: "Read 50%", value: totals.depth50 },
    { stage: "Finished", value: totals.depth100 },
    { stage: "Full Read", value: totals.fullReads ?? 0 },
    { stage: "Shared", value: totals.shares },
    { stage: "Supported", value: supporters },
  ], [totals, supporters])

  const liveSignal = sQ.data || aQ.data || tQ.data ? "live" : "loading"

  const kpis = [
    {
      label: `Views (${days}d)`,
      value: formatCompactNumber(totals.views),
      delta: viewsDelta,
      icon: Eye,
    },
    {
      label: `Unique (${days}d)`,
      value: formatCompactNumber(totals.uniqueViews ?? 0),
      delta: 0,
      icon: Eye,
    },
    {
      label: `Full Reads`,
      value: formatCompactNumber(totals.fullReads ?? 0),
      delta: 0,
      icon: TrendingUp,
    },
    {
      label: "Read ≥50%",
      value: `${readPct}%`,
      delta: 0,
      icon: TrendingUp,
    },
    {
      label: "Mode switches",
      value: formatCompactNumber(totals.modeSwitches),
      delta: 0,
      icon: Activity,
    },
    {
      label: `Revenue (${days}d)`,
      value: rupees(revenue30d),
      delta: revenueDelta,
      icon: IndianRupee,
    },
  ]

  if (!mounted || planLoading) {
    return (
      <div className="mx-auto w-full max-w-350 p-6 md:p-8">
        <div className="h-32 w-full animate-pulse rounded-md bg-muted/20" />
      </div>
    )
  }

  if (!hasStudio) {
    return (
      <div className="mx-auto w-full max-w-350 p-6 md:p-8">
        <div className="surface-elevated mt-12 flex flex-col items-center justify-center gap-4 rounded-md p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="size-6 text-primary" />
          </div>
          <h2 className="font-display text-2xl">Studio plan required</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Advanced analytics, cohort analysis, and funnel tracking are available on the Studio plan.
          </p>
          <Link href="/pricing">
            <Button className="mt-2">Upgrade to Studio</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-350 p-6 md:p-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Studio
          </p>
          <h1 className="font-display text-3xl text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last {days} days · {published} published · signal:{" "}
            <span className="text-foreground">{liveSignal}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-border">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs ${days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <KpiGrid kpis={kpis} />

      {/* Below the KPIs so its late arrival does not shift them (CLS). */}
      {tQ.isSuccess && totals.views === 0 && (
        <div className="surface mb-6 rounded-md p-5 text-sm text-muted-foreground">
          No reader events yet in this window. Publish a piece and share it —
          view, mode-switch and read-depth events will appear here in real time.
        </div>
      )}

      {/* Row 1: views area + mode pie */}
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <ViewsAreaChart seriesRich={seriesRich} days={days} />
        <ModePieChart modeDist={modeDist} hasData={modeDistHasData} />
      </div>

      {/* Row 2: revenue line + funnel bar */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <InView height={312}><RevenueLineChart seriesRich={seriesRich} days={days} /></InView>
        <InView height={312}><ReaderFunnelChart funnel={funnel} /></InView>
      </div>

      {/* Row 3: top pieces + engagement radial */}
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <InView height={332} className="lg:col-span-2"><TopPiecesBarChart topPieces={topPieces} /></InView>
        <InView height={332}>
          <CompletionRadialChart
            completionPct={completionPct}
            supporters={supporters}
          />
        </InView>
      </div>

      {/* Row 4: Cohort Matrix */}
      <div className="grid gap-6">
        <InView height={192}><CohortMatrixChart cohorts={cQ.data?.cohorts ?? []} /></InView>
      </div>
    </div>
  )
}
