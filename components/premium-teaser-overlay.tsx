"use client"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PremiumTeaserOverlay({
  onSubscribe,
  onBuy,
  pricePaise,
  title,
  authorName
}: {
  onSubscribe: () => void
  onBuy?: () => void
  pricePaise?: number
  title?: string
  authorName?: string
}) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/60 backdrop-blur-md">
      <div className="sticky top-1/3 mx-auto max-w-sm text-center p-6 bg-surface border border-border shadow-lg rounded-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-xl font-display font-bold text-foreground mb-2">
          Premium content
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          {title 
            ? `Unlock full access to "${title}" and other premium content from ${authorName || "this author"}.`
            : "Unlock full access to this content by subscribing to the author."}
        </p>
        {onBuy && pricePaise && (
          <Button onClick={onBuy} className="mb-2 w-full">
            Unlock this piece · ₹{pricePaise / 100}
          </Button>
        )}
        <Button onClick={onSubscribe} variant={onBuy ? "outline" : "default"} className="w-full">
          Subscribe to unlock
        </Button>
      </div>
    </div>
  )
}
