import { Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ChartSeries } from "./types"

interface Props {
  chartType: "bar" | "line" | "area" | "pie" | "radar" | "scatter" | "composed"
  labels: string[]
  series: ChartSeries[]
  caption?: string
  onChange: (patch: {
    chartType?:
      | "bar"
      | "line"
      | "area"
      | "pie"
      | "radar"
      | "scatter"
      | "composed"
    labels?: string[]
    series?: ChartSeries[]
    caption?: string
  }) => void
}

export function ChartBlockEditor({
  chartType,
  labels,
  series,
  caption,
  onChange,
}: Props) {
  const setLabel = (i: number, v: string) => {
    const next = [...labels]
    next[i] = v
    onChange({ labels: next })
  }
  const addLabel = () => {
    const next = [...labels, `L${labels.length + 1}`]
    const ns = series.map((s) => ({ ...s, data: [...s.data, 0] }))
    onChange({ labels: next, series: ns })
  }
  const removeLabel = (i: number) => {
    const next = labels.filter((_, j) => j !== i)
    const ns = series.map((s) => ({
      ...s,
      data: s.data.filter((_, j) => j !== i),
    }))
    onChange({ labels: next, series: ns })
  }
  const setSeriesLabel = (i: number, v: string) => {
    const ns = series.map((s, j) => (j === i ? { ...s, label: v } : s))
    onChange({ series: ns })
  }
  const setValue = (si: number, di: number, v: string) => {
    const n = Number(v)
    const ns = series.map((s, j) => {
      if (j !== si) return s
      const d = [...s.data]
      d[di] = Number.isFinite(n) ? n : 0
      return { ...s, data: d }
    })
    onChange({ series: ns })
  }
  const addSeries = () => {
    onChange({
      series: [
        ...series,
        { label: `Series ${series.length + 1}`, data: labels.map(() => 0) },
      ],
    })
  }
  const removeSeries = (i: number) => {
    onChange({ series: series.filter((_, j) => j !== i) })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select
          value={chartType}
          onValueChange={(v) => onChange({ chartType: v as typeof chartType })}
        >
          <SelectTrigger aria-label="Chart type" className="h-7 w-28 rounded border border-input bg-background px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bar">Bar</SelectItem>
            <SelectItem value="line">Line</SelectItem>
            <SelectItem value="area">Area</SelectItem>
            <SelectItem value="pie">Pie</SelectItem>
            <SelectItem value="radar">Radar</SelectItem>
            <SelectItem value="scatter">Scatter</SelectItem>
            <SelectItem value="composed">Composed</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={caption ?? ""}
          onChange={(e) => onChange({ caption: e.target.value })}
          placeholder="Caption (optional)"
          className="h-7 flex-1 text-xs"
        />
      </div>

      <div>
        <p className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
          Labels
        </p>
        <div className="flex flex-wrap gap-1.5">
          {labels.map((lab, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                value={lab}
                onChange={(e) => setLabel(i, e.target.value)}
                className="h-7 w-20 text-xs"
              />
              <button
                type="button"
                onClick={() => removeLabel(i)}
                className="inline-flex size-6 items-center justify-center text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={addLabel}
          >
            <Plus className="mr-1 size-3" /> Label
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] tracking-wider text-muted-foreground uppercase">
            Series
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={addSeries}
          >
            <Plus className="mr-1 size-3" /> Series
          </Button>
        </div>
        {series.map((s, si) => (
          <div key={si} className="surface space-y-1 rounded p-2">
            <div className="flex items-center gap-1">
              <Input
                value={s.label}
                onChange={(e) => setSeriesLabel(si, e.target.value)}
                className="h-7 flex-1 text-xs"
              />
              <button
                type="button"
                onClick={() => removeSeries(si)}
                className="inline-flex size-6 items-center justify-center text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {labels.map((_, di) => (
                <Input
                  key={di}
                  type="number"
                  value={s.data[di] ?? 0}
                  onChange={(e) => setValue(si, di, e.target.value)}
                  className="h-7 w-16 font-mono text-xs"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
