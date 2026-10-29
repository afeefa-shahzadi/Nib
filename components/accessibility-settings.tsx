"use client"
import { Accessibility } from "lucide-react"
import { useMyPlan } from "@/hooks/use-my-plan"

// Document-upload verification is parked (park/paid-features).
export function AccessibilitySettings() {
  const { launchFree } = useMyPlan()
  return (
    <div className="surface-elevated space-y-2 rounded-md p-6">
      <p className="font-medium text-foreground flex items-center gap-2">
        <Accessibility className="size-4" /> Accessibility features
      </p>
      <p className="text-sm text-muted-foreground">
        {launchFree
          ? "Free launch — all features unlocked, including AI voice listening, ELI5 summaries and voice dictation."
          : "Accessibility verification is temporarily unavailable."}
      </p>
    </div>
  )
}
