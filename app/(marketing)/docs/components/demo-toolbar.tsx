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
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
    >
      <RotateCcw className="size-3" /> Reset
    </button>
  )
}
