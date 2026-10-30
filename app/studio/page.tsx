import { Suspense } from "react"
import { getStudioStats, getRecentActivity, getMyRole, getMyProfile } from "@/actions/content"
import { StudioSkeleton } from "@/components/studio/studio-skeleton"
import { getFollowingFeed, listFollowing } from "@/actions/social"
import { getAllMyHighlights } from "@/actions/highlights"
import { createClient } from "@/lib/supabase/server"
import { AuthorDashboardClient } from "./author-dashboard-client"
import { ReaderDashboardClient } from "./reader-dashboard-client"
import { ActivationChecklist } from "./activation-checklist"

export const dynamic = "force-dynamic"

async function AuthorDashboardServer({ orgId }: { orgId?: string }) {
  const [stats, activity, me] = await Promise.all([
    getStudioStats({ data: { org_id: orgId } }),
    getRecentActivity({ data: { org_id: orgId } }),
    getMyProfile().catch(() => null),
  ])
  return (
    <AuthorDashboardClient
      checklist={<ActivationChecklist />}
      stats={stats}
      activity={activity}
      name={(me as { display_name?: string } | null)?.display_name}
    />
  )
}

async function ReaderDashboardServer() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [feed, follows, highlights] = await Promise.all([
    getFollowingFeed(),
    listFollowing({ data: { follower_id: user?.id } }),
    getAllMyHighlights()
  ])
  return (
    <ReaderDashboardClient
      feed={feed}
      follows={follows}
      highlights={highlights}
    />
  )
}

export default async function Dashboard(props: {
  searchParams: Promise<{ org?: string }>
}) {
  const searchParams = await props.searchParams
  const { primary } = await getMyRole()
  const isAuthor = primary === "admin" || primary === "creator"

  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-350 px-4 py-6 sm:px-6 md:px-8">
          <StudioSkeleton />
        </div>
      }
    >
      {isAuthor ? (
        <AuthorDashboardServer orgId={searchParams?.org} />
      ) : (
        <ReaderDashboardServer />
      )}
    </Suspense>
  )
}
