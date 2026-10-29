"use client"
import { WaitlistButton } from "@/components/waitlist-button"
import { useAuth } from "@/hooks/use-auth"
import { Heart } from "lucide-react"

// authorId/authorName/contentObjectId stay in the signature: callers pass them
// and tipping returns after launch.
export function TipJar(props: {
  authorId: string
  authorName: string
  contentObjectId?: string
}) {
  void props
  const { user } = useAuth()

  return (
    <div className="surface rounded-md p-5">
      <div className="mb-3 flex items-center gap-2">
        <Heart className="size-4 text-primary" />
        <p className="text-xs tracking-wider text-muted-foreground uppercase">
          Tip the author
        </p>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Tipping opens after launch. Join the waitlist and we&apos;ll tell you.
      </p>
      <WaitlistButton item="tip" source="tip_jar" signedIn={!!user} variant="outline" size="sm" />
    </div>
  )
}
