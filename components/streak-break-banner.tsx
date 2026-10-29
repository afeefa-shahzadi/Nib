"use client"

import { useState } from "react"
import { Flame, RefreshCw, X, Loader2, Coins } from "lucide-react"
import { restoreStreak } from "@/actions/monetization"
import { streakRestoreCost } from "@/lib/tier"
import confetti from "canvas-confetti"
import { toast } from "sonner"
import { cssColor } from "@/lib/css-color"

interface StreakBreakBannerProps {
  previousStreak: number
  currentCredits: number
  onDismiss: () => void
  onRestored: (newStreak: number) => void
}

export function StreakBreakBanner({ previousStreak, currentCredits, onDismiss, onRestored }: StreakBreakBannerProps) {
  const [loading, setLoading] = useState(false)
  const [restored, setRestored] = useState(false)

  const cost = streakRestoreCost(previousStreak)
  const canAfford = currentCredits >= cost

  const handleRestore = async () => {
    try {
      setLoading(true)
      const res = await restoreStreak()
      if (res.success && "restoredStreak" in res) {
        setRestored(true)
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.1 },
          colors: ["--warn", "--note"].map(cssColor),
        })
        toast.success(`🔥 Streak restored to ${res.restoredStreak} days! (${res.creditsSpent} credits spent)`)
        onRestored(res.restoredStreak)
        setTimeout(onDismiss, 2000)
      } else {
        const messages: Record<string, string> = {
          insufficient_credits: `Not enough credits. Need ${cost}, you have ${currentCredits}.`,
          window_expired: "The 47-hour restore window has passed.",
          no_break: "No streak to restore.",
          unauthorized: "Please sign in.",
        }
        const reason = "reason" in res ? (res.reason as string) : ""
        toast.error(messages[reason] ?? "Could not restore streak.")
        onDismiss()
      }
    } catch {
      toast.error("Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  if (restored) {
    return (
      <div className="flex items-center gap-3 border-b border-warn/20 bg-warn/10 px-4 py-2.5 text-sm font-medium text-warn">
        <Flame className="size-4 shrink-0" />
        <span>🔥 Streak restored! Keep it going!</span>
      </div>
    )
  }

  return (
    <div className="relative flex flex-wrap items-center gap-3 border-b border-destructive/20 bg-destructive/5 px-4 py-3">
      <button
        onClick={onDismiss}
        className="absolute right-3 top-3 rounded-md p-0.5 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>

      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
        <Flame className="size-4 text-destructive" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">
          Your {previousStreak}-day streak broke 😢
        </p>
        <p className="text-xs text-muted-foreground">
          Restore window: 47 hours ·{" "}
          <span className="inline-flex items-center gap-0.5">
            <Coins className="size-3" /> costs {cost} credits
          </span>
          {" "}· you have {currentCredits}
        </p>
      </div>

      {canAfford ? (
        <button
          onClick={handleRestore}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-warn px-3 py-1.5 text-xs font-semibold text-warn-foreground shadow transition-colors hover:bg-warn disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Restore ({cost} credits)
        </button>
      ) : (
        <span className="shrink-0 rounded-lg border border-dashed border-muted-foreground/40 px-3 py-1.5 text-xs text-muted-foreground">
          Need {cost - currentCredits} more credits
        </span>
      )}
    </div>
  )
}
