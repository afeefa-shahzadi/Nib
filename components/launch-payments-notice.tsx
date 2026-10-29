"use client"
import { useMyPlan } from "@/hooks/use-my-plan"
import { cn } from "@/lib/utils"

/** Plain statement that no money moves while the free launch is on. Renders nothing after launch. */
export function LaunchPaymentsNotice({ className }: { className?: string }) {
  const { launchFree } = useMyPlan()
  if (!launchFree) return null
  return (
    <div role="note" className={cn("rounded-md border border-primary/30 bg-primary/5 p-4 text-sm", className)}>
      <p className="font-semibold text-foreground">No payments during launch</p>
      <p className="mt-1 text-muted-foreground">
        Nib doesn&apos;t charge you or pay out money while we&apos;re in launch. Every feature is free, and nothing
        here takes or sends real money. Paid plans and payouts open later, and you can join the waitlist to hear first.
      </p>
    </div>
  )
}
