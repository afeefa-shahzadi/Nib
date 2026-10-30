import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  RadialBarChart,
  RadialBar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

// Themed hover tip: popover colours in light and dark, soft hover band on bars.
const tip = {
  contentStyle: {
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 13,
    fontFamily: "var(--font-sans, inherit)",
    boxShadow:
      "0 4px 16px color-mix(in oklab, var(--foreground) 12%, transparent)",
  },
  labelStyle: { color: "var(--popover-foreground)", fontWeight: 500 },
  itemStyle: { paddingBlock: 2 },
  cursor: { fill: "var(--muted)", opacity: 0.5, stroke: "var(--border)" },
}
import { IndianRupee, FileText, MessagesSquare } from "lucide-react"

type SeriesRichItem = {
  date: string
  views: number
  depth100: number
  revenue: number
  cumRevenue: number
}

type ModeDistItem = {
  name: string
  value: number
  fill: string
}

type FunnelItem = {
  stage: string
  value: number
}

type TopPieceItem = {
  title: string
  views: number
  reads: number
}

export function ViewsAreaChart({
  seriesRich,
  days,
}: {
  seriesRich: SeriesRichItem[]
  days: number
}) {
  return (
    <div className="surface rounded-lg p-4 lg:col-span-2">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-lg text-foreground">
          Views and finishes
        </h2>
        <span className="text-sm text-muted-foreground">
          Readers who opened and reached the end, per day
        </span>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart
          data={seriesRich}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gReads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--success)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            opacity={0.4}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            interval={Math.ceil(days / 8)}
          />
          <YAxis
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            allowDecimals={false}
            width={35}
          />
          <Tooltip {...tip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="views"
            name="Views"
            stroke="var(--primary)"
            fill="url(#gViews)"
            strokeWidth={2}
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="depth100"
            name="Finishes"
            stroke="var(--success)"
            fill="url(#gReads)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ModePieChart({
  modeDist,
  hasData,
}: {
  modeDist: ModeDistItem[]
  hasData: boolean
}) {
  return (
    <div className="surface rounded-lg p-4">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-lg text-foreground">Reading mode</h2>
        <span className="text-sm text-muted-foreground">
          Modes readers switched to
        </span>
      </div>
      {hasData ? (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              isAnimationActive={false}
              data={modeDist}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
            />
            <Tooltip {...tip} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No mode switches yet.
        </p>
      )}
    </div>
  )
}

export function RevenueLineChart({
  seriesRich,
  days,
}: {
  seriesRich: SeriesRichItem[]
  days: number
}) {
  return (
    <div className="surface rounded-lg p-4">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="inline-flex items-center gap-2 font-display text-lg text-foreground">
          <IndianRupee className="size-4 text-primary" /> Revenue
        </h2>
        <span className="text-sm text-muted-foreground">
          Paid sales per day and running total
        </span>
      </div>
      {seriesRich.some((d) => d.revenue > 0) ? (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart
            data={seriesRich}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              opacity={0.4}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              interval={Math.ceil(days / 8)}
            />
            <YAxis
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              width={48}
            />
            <Tooltip {...tip} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              isAnimationActive={false}
              type="monotone"
              dataKey="revenue"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
              name="Per day (₹)"
            />
            <Line
              isAnimationActive={false}
              type="monotone"
              dataKey="cumRevenue"
              stroke="var(--note)"
              strokeWidth={2}
              dot={false}
              name="Running total (₹)"
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="py-24 text-center text-sm text-muted-foreground">
          No sales in this period.
        </p>
      )}
    </div>
  )
}

export function ReaderFunnelChart({ funnel }: { funnel: FunnelItem[] }) {
  return (
    <div className="surface rounded-lg p-4">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-lg text-foreground">Reader funnel</h2>
        <span className="text-sm text-muted-foreground">
          How far readers get, from opening to supporting
        </span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={funnel}
          layout="vertical"
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            opacity={0.4}
          />
          <XAxis
            type="number"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="stage"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            width={112}
          />
          <Tooltip {...tip} />
          <Bar
            isAnimationActive={false}
            dataKey="value"
            name="Readers"
            fill="var(--primary)"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TopPiecesBarChart({
  topPieces,
}: {
  topPieces: TopPieceItem[]
}) {
  return (
    <div className="surface rounded-lg p-4 lg:col-span-2">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="inline-flex items-center gap-2 font-display text-lg text-foreground">
          <FileText className="size-4 text-muted-foreground" /> Top pieces
        </h2>
        <span className="text-sm text-muted-foreground">
          Views and readers who got at least halfway
        </span>
      </div>
      {topPieces.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No readers yet in this period.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={topPieces}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              opacity={0.4}
            />
            <XAxis
              dataKey="title"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={70}
            />
            <YAxis
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              allowDecimals={false}
            />
            <Tooltip {...tip} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              isAnimationActive={false}
              dataKey="views"
              name="Views"
              fill="var(--primary)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              isAnimationActive={false}
              dataKey="reads"
              name="Read half"
              fill="var(--success)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export function CompletionRadialChart({
  completionPct,
  supporters,
}: {
  completionPct: number
  supporters: number
}) {
  const engagement = [
    { name: "Completion", value: completionPct, fill: "var(--primary)" },
  ]
  return (
    <div className="surface rounded-lg p-4">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="inline-flex items-center gap-2 font-display text-lg text-foreground">
          <MessagesSquare className="size-4 text-muted-foreground" /> Completion
        </h2>
        <span className="text-sm text-muted-foreground">
          Share of views that reached the end
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <RadialBarChart
          innerRadius="60%"
          outerRadius="100%"
          data={engagement}
          startAngle={90}
          endAngle={-270}
        >
          <RadialBar
            isAnimationActive={false}
            background
            dataKey="value"
            cornerRadius={8}
          />
          <Tooltip
            {...tip}
            labelFormatter={() => ""}
            formatter={(v) => [`${v}%`, "Reached the end"]}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <p className="pointer-events-none -mt-32 text-center font-display text-3xl text-foreground">
        {completionPct}%
      </p>
      <p className="mt-24 text-center text-xs text-muted-foreground">
        {supporters} active supporters
      </p>
    </div>
  )
}

export type CohortItem = {
  cohort: string
  size: number
  [key: `month${number}`]: number
}

export function CohortMatrixChart({ cohorts }: { cohorts: CohortItem[] }) {
  if (!cohorts || cohorts.length === 0) {
    return (
      <div className="surface rounded-lg p-4 lg:col-span-3">
        <h2 className="mb-4 font-display text-lg text-foreground">
          Supporter retention
        </h2>
        <p className="py-12 text-center text-sm text-muted-foreground">
          No supporters to track yet.
        </p>
      </div>
    )
  }

  // Calculate color intensity for heatmap (opacity based on percentage)
  const getCellColor = (pct: number) => {
    if (pct === 0) return "transparent"
    const opacity = Math.max(0.1, pct / 100)
    return `color-mix(in oklab, var(--success) ${Math.round(opacity * 100)}%, transparent)`
  }

  return (
    <div className="surface overflow-x-auto rounded-lg p-4 lg:col-span-3">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-lg text-foreground">
          Supporter retention
        </h2>
        <span className="text-sm text-muted-foreground">
          Share of each month&apos;s new supporters still reading, by month
        </span>
      </div>

      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className="min-w-25 border-b border-border p-2 font-medium text-muted-foreground">
              Cohort
            </th>
            <th className="border-b border-border p-2 font-medium text-muted-foreground">
              Size
            </th>
            <th className="border-b border-border p-2 font-medium text-muted-foreground">
              M0
            </th>
            <th className="border-b border-border p-2 font-medium text-muted-foreground">
              M1
            </th>
            <th className="border-b border-border p-2 font-medium text-muted-foreground">
              M2
            </th>
            <th className="border-b border-border p-2 font-medium text-muted-foreground">
              M3
            </th>
            <th className="border-b border-border p-2 font-medium text-muted-foreground">
              M4
            </th>
            <th className="border-b border-border p-2 font-medium text-muted-foreground">
              M5
            </th>
            <th className="border-b border-border p-2 font-medium text-muted-foreground">
              M6
            </th>
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr
              key={c.cohort}
              className="border-b border-border/50 hover:bg-muted/50"
            >
              <td className="p-2 font-medium">{c.cohort}</td>
              <td className="p-2 text-muted-foreground">{c.size}</td>
              {[0, 1, 2, 3, 4, 5, 6].map((m) => {
                const pct = c[`month${m}`]
                return (
                  <td key={m} className="p-1">
                    <div
                      className="flex h-8 w-12 items-center justify-center rounded text-xs font-medium"
                      style={{
                        backgroundColor: getCellColor(pct),
                        color:
                          pct > 40 ? "var(--background)" : "var(--foreground)",
                      }}
                    >
                      {pct > 0 ? `${pct}%` : "-"}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
