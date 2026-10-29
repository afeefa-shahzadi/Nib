"use client"

import { useState } from "react"
import { Maximize2 } from "lucide-react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Block, getStr } from "../block-renderer"
import { MediaLightbox } from "./media-lightbox"

const COLORS = ["var(--primary)", "var(--success)", "var(--note)", "var(--destructive)", "var(--info)"]

const tooltipStyle = {
  fontSize: "12px",
  borderRadius: "6px",
  backgroundColor: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
  color: "var(--color-foreground)",
}

const axisProps = {
  tick: { fontSize: 10, fill: "var(--color-muted-foreground)" },
  axisLine: false as const,
  tickLine: false as const,
}

type ChartData = Record<string, unknown>[]
type Series = Array<{ label: string; data: number[] }>

function ChartInner({
  chartType,
  data,
  series,
  labels,
}: {
  chartType: string
  data: ChartData
  series: Series
  labels: string[]
}) {
  const gridAndAxes = (
    <>
      <CartesianGrid
        strokeDasharray="3 3"
        vertical={false}
        stroke="var(--color-border)"
      />
      <XAxis dataKey="name" {...axisProps} />
      <YAxis {...axisProps} />
      <Tooltip contentStyle={tooltipStyle} />
      <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
    </>
  )

  return (
    <ResponsiveContainer width="100%" height="100%">
      {chartType === "bar" ? (
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          {gridAndAxes}
          {series.map((s, j) => (
            <Bar
              key={j}
              dataKey={s.label}
              fill={COLORS[j % COLORS.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      ) : chartType === "area" ? (
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          {gridAndAxes}
          {series.map((s, j) => (
            <Area
              key={j}
              type="monotone"
              dataKey={s.label}
              stroke={COLORS[j % COLORS.length]}
              fill={COLORS[j % COLORS.length]}
              fillOpacity={0.3}
            />
          ))}
        </AreaChart>
      ) : chartType === "pie" ? (
        <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
          {series.map((s, j) => (
            <Pie
              key={j}
              data={data}
              dataKey={s.label}
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80 - j * 20}
              fill={COLORS[j % COLORS.length]}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          ))}
        </PieChart>
      ) : chartType === "radar" ? (
        <RadarChart
          data={data}
          margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
        >
          <PolarGrid stroke="var(--color-border)" />
          <PolarAngleAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
          />
          <PolarRadiusAxis
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
          {series.map((s, j) => (
            <Radar
              key={j}
              name={s.label}
              dataKey={s.label}
              stroke={COLORS[j % COLORS.length]}
              fill={COLORS[j % COLORS.length]}
              fillOpacity={0.5}
            />
          ))}
        </RadarChart>
      ) : chartType === "scatter" ? (
        <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          {/* Scatter plots each point by its own data keys; the shared axes have no Y key, so nothing drew. */}
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="name" type="category" allowDuplicatedCategory={false} {...axisProps} />
          <YAxis dataKey="value" type="number" {...axisProps} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
          {series.map((s, j) => {
            const scatterData = labels.map((label, index) => ({
              name: label,
              value: s.data?.[index] ?? 0,
            }))
            return (
              <Scatter
                key={j}
                name={s.label}
                data={scatterData}
                fill={COLORS[j % COLORS.length]}
              />
            )
          })}
        </ScatterChart>
      ) : chartType === "composed" ? (
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          {gridAndAxes}
          {series.map((s, j) =>
            j === 0 ? (
              <Bar
                key={j}
                dataKey={s.label}
                fill={COLORS[j % COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ) : (
              <Line
                key={j}
                type="monotone"
                dataKey={s.label}
                stroke={COLORS[j % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            )
          )}
        </ComposedChart>
      ) : (
        <LineChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          {gridAndAxes}
          {series.map((s, j) => (
            <Line
              key={j}
              type="monotone"
              dataKey={s.label}
              stroke={COLORS[j % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
  )
}

export function ChartBlock({ block }: { block: Block }) {
  const labels = Array.isArray(block.content.labels)
    ? (block.content.labels as string[])
    : []
  const series = Array.isArray(block.content.series)
    ? (block.content.series as Series)
    : []
  const cap = getStr(block.content, "caption")
  const chartType = (block.content.chartType ?? "bar") as string
  const [open, setOpen] = useState(false)

  if (labels.length === 0 || series.length === 0) {
    return (
      <p className="my-6 text-xs text-muted-foreground italic">(empty chart)</p>
    )
  }

  const data: ChartData = labels.map((label, index) => {
    const obj: Record<string, unknown> = { name: label }
    series.forEach((s) => {
      obj[s.label] = s.data?.[index] ?? 0
    })
    return obj
  })

  return (
    <>
      <figure className="surface group relative my-6 rounded-md p-5">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-[10px] tracking-[0.18em] text-primary uppercase">
            {chartType} chart
          </p>
          <button
            onClick={() => setOpen(true)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            title="Fullscreen"
            aria-label="Fullscreen"
          >
            <Maximize2 className="size-4" />
          </button>
        </div>
        <div className="h-64 w-full">
          <ChartInner
            chartType={chartType}
            data={data}
            series={series}
            labels={labels}
          />
        </div>
        {cap && (
          <figcaption className="mt-6 text-center text-xs text-muted-foreground italic">
            {cap}
          </figcaption>
        )}
      </figure>

      <MediaLightbox open={open} onClose={() => setOpen(false)}>
        <div className="w-[85vw] max-w-4xl rounded-lg bg-background p-8">
          <p className="mb-4 text-[10px] tracking-[0.18em] text-primary uppercase">
            {chartType} chart{cap && ` — ${cap}`}
          </p>
          <div className="h-[65vh] w-full">
            <ChartInner
              chartType={chartType}
              data={data}
              series={series}
              labels={labels}
            />
          </div>
        </div>
      </MediaLightbox>
    </>
  )
}
