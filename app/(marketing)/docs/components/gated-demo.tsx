"use client"
import { useState } from "react"
import { Lock, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function GatedDemo() {
  const [unlocked, setUnlocked] = useState(false)
  return (
    <div className="surface overflow-hidden rounded-xl border border-border/60">
      <div className="p-6">
        <p className="text-foreground/90">
          Public paragraph — every reader sees this. It sets up the argument.
        </p>
      </div>
      <div className="hairline-t relative">
        {/* Same lock overlay and blur the reader uses on gated blocks (components/block-renderer.tsx). */}
        {!unlocked && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
            <Lock className="h-5 w-5 text-muted-foreground" aria-hidden />
            <p className="mt-2 text-sm font-medium text-foreground">Premium content</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setUnlocked(true)
                toast.success("Unlocked (demo)")
              }}
            >
              Unlock
            </Button>
          </div>
        )}
        <div className={`space-y-3 p-6 ${unlocked ? "" : "pointer-events-none blur-xs opacity-40 select-none"} transition-all duration-500`}>
          <p className="text-foreground/90">
            Premium paragraph — only members see this. It contains the
            proprietary framework, internal data, or methodology that&apos;s
            worth charging for.
          </p>
          <p className="text-foreground/90">
            A second paid paragraph continues the argument. The gate is
            per-block, not per-piece.
          </p>
          {unlocked && (
            <button
              type="button"
              onClick={() => {
                setUnlocked(false)
                toast("Re-locked")
              }}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            >
              <RotateCcw className="size-3" /> Re-lock demo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
