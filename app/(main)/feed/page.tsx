import { Rss } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getFollowingFeed, getDiscoverFeed } from "@/actions/social"
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
    getDiscoverFeed(),
  ])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="container-wide flex-1 pt-16 pb-12 md:pt-24">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 text-xs tracking-[0.2em] text-muted-foreground uppercase">
              <Rss className="size-3.5" /> Feed
            </p>
            <h1 className="font-display text-4xl tracking-tight md:text-5xl">
              What&apos;s new on Nib
            </h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              The freshest pieces from authors you follow and the network at
              large.
            </p>
          </div>
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
