"use client"
import { WaitlistButton } from "@/components/waitlist-button"
import { useAuth } from "@/hooks/use-auth"

// pieceId stays in the signature: sponsorship checkout returns after launch.
export function PublicSponsorCard(props: { pieceId: string }) {
  void props
  const { user } = useAuth()

  return (
    <div className="mt-16 rounded-2xl border border-border bg-linear-to-br from-muted/30 to-muted/10 p-6 sm:p-8">
      <h3 className="font-display text-xl sm:text-2xl mb-2 text-foreground">
        Become a Sponsor
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        Support this piece on behalf of your organization. Sponsorships open after launch. Join the waitlist and we&apos;ll tell you.
      </p>
      <WaitlistButton
        className="w-full sm:w-auto"
        size="lg"
        item="sponsorship"
        source="sponsor_card"
        signedIn={!!user}
      />
    </div>
  )
}
