"use client"
import { RotateCcw } from "lucide-react"
import { toast } from "sonner"

export function DemoToolbar({
  onReset,
  label,
}: {
  onReset: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onReset()
        toast.success(`${label} reset`)
      }}
      aria-label={`Reset ${label} demo`}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 py-1 text-sm text-muted-foreground lg:min-h-8 hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
    >
      <RotateCcw className="size-3" /> Reset
    </button>
  )
}
