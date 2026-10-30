import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react"

export type KpiItem = {
  label: string
  value: string
  delta: number
  icon: LucideIcon
}

export function KpiGrid({ kpis }: { kpis: KpiItem[] }) {
  return (
    <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3">
      {kpis.map((c) => {
        const Icon = c.icon
        const up = c.delta >= 0
        return (
          <div
            key={c.label}
            className="surface flex flex-col gap-2 rounded-lg p-4"
          >
            <p className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              {c.label}
              <Icon className="size-4 shrink-0" aria-hidden />
            </p>
            <p className="font-display text-2xl text-foreground tabular-nums">
              {c.value}
            </p>
            {c.delta !== 0 && (
              <p
                className={`inline-flex items-center gap-1 text-sm ${
                  up ? "text-success" : "text-destructive"
                }`}
              >
                {up ? (
                  <ArrowUpRight className="size-4" aria-hidden />
                ) : (
                  <ArrowDownRight className="size-4" aria-hidden />
                )}
                {up ? "Up" : "Down"} {Math.abs(c.delta)}% on the earlier half
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
