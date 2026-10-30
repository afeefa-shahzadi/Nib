import { createClient } from "@/lib/supabase/server"
import { getFollowingFeed } from "@/actions/social"
import { cachedDiscoverFeed } from "@/lib/public-cache"
import { FeedClient } from "./feed-client"
import { ComponentProps } from "react"

export default async function FeedPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const signedIn = !!session

  // Fetch initial data in parallel
  const [followingRes, discoverRes] = await Promise.all([
    signedIn ? getFollowingFeed() : Promise.resolve(null),
    cachedDiscoverFeed(),
  ])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="container-wide flex-1 pt-16 pb-12 md:pt-24">
        <header className="mb-8">
          <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">What&apos;s new on Nib</h1>
          <p className="mt-4 max-w-[38rem] text-lg leading-relaxed text-muted-foreground">
            New pieces from writers you follow, and from everyone else.
          </p>
        </header>

        <FeedClient
          signedIn={signedIn}
          initialFollowing={
            followingRes as ComponentProps<
              typeof FeedClient
            >["initialFollowing"]
          }
          initialDiscover={
            discoverRes as ComponentProps<typeof FeedClient>["initialDiscover"]
          }
        />
      </main>
    </div>
  )
}
