import { Suspense } from "react"
import { getStudioStats, getRecentActivity, getMyRole } from "@/actions/content"
import { getFollowingFeed, listFollowing } from "@/actions/social"
import { getAllMyHighlights } from "@/actions/highlights"
import { createClient } from "@/lib/supabase/server"
import { AuthorDashboardClient } from "./author-dashboard-client"
import { ReaderDashboardClient } from "./reader-dashboard-client"
import { ActivationChecklist } from "./activation-checklist"

export const dynamic = "force-dynamic"

async function AuthorDashboardServer({ orgId }: { orgId?: string }) {
  const [stats, activity] = await Promise.all([
    getStudioStats({ data: { org_id: orgId } }),
    getRecentActivity({ data: { org_id: orgId } }),
  ])
  return (
    <>
      <div className="mx-auto w-full max-w-350 px-6 pt-6 md:px-8 md:pt-8">
        <ActivationChecklist />
      </div>
      <AuthorDashboardClient stats={stats} activity={activity} />
    </>
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
        <div className="p-8 text-sm text-muted-foreground">
          Loading dashboard...
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
