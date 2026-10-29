import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react"

export type KpiItem = {
  label: string
  value: string
  delta: number
  icon: LucideIcon
}

export function KpiGrid({ kpis }: { kpis: KpiItem[] }) {
  return (
    <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {kpis.map((c) => {
        const Icon = c.icon
        const up = c.delta >= 0
        return (
          <div key={c.label} className="surface rounded-md p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] tracking-wider text-muted-foreground uppercase">
                {c.label}
              </p>
              <Icon className="size-3.5 text-muted-foreground" />
            </div>
            <p className="font-display text-2xl text-foreground">{c.value}</p>
            {c.delta !== 0 && (
              <p
                className={`mt-1 inline-flex items-center gap-1 text-xs ${
                  up ? "text-success" : "text-destructive"
                }`}
              >
                {up ? (
                  <ArrowUpRight className="size-3" />
                ) : (
                  <ArrowDownRight className="size-3" />
                )}
                {Math.abs(c.delta)}% vs prev
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
