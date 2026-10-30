import type { Metadata } from "next"
import StudioLayoutClient from "./layout-client"
import { getMyRole } from "@/actions/content"
import { StudioRole } from "@/hooks/use-my-role"
import { RestrictionBanner } from "@/components/restriction-banner"
import { ConsentBanner } from "@/components/auth/consent-banner"
import { after } from "next/server"
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query"
import { getMyProfile } from "@/actions/content"
import { getMyPlan } from "@/actions/subscriptions"
import { listMyOrgs } from "@/actions/orgs"
import { unreadCount } from "@/actions/social"
import { tickReadingStreak } from "@/actions/monetization"
import { getMyRestriction } from "@/actions/restrictions"
import { getMyConsentStatus } from "@/actions/parental-consent"

export const metadata: Metadata = {
  title: "Studio — Nib",

  openGraph: {
    title: "Studio — Nib",

    url: "/studio",
  },
  alternates: {
    canonical: "/studio",
  },
}

// The browser runs server actions one at a time, so the layout's own reads
// (profile, plan, orgs, unread, banners) used to queue ahead of every page's
// data request. Load them here in parallel and hand them down instead; a read
// that fails is left for the client query to retry.
const soft = <T,>(p: Promise<T>) => p.catch(() => undefined)

export default async function Layout({ children }: { children: React.ReactNode }) {
  const [{ primary }, profile, plan, orgs, unread, restriction, consent] = await Promise.all([
    getMyRole(),
    soft(getMyProfile()),
    soft(getMyPlan()),
    soft(listMyOrgs()),
    soft(unreadCount()),
    soft(getMyRestriction()),
    soft(getMyConsentStatus()),
  ])
  // Idempotent (skips if already ticked today); not needed to render.
  after(() => tickReadingStreak().catch(() => {}))

  const qc = new QueryClient()
  if (profile !== undefined) qc.setQueryData(["my-profile"], profile)
  if (plan !== undefined) qc.setQueryData(["my-plan"], plan)
  if (orgs !== undefined) qc.setQueryData(["my-orgs"], orgs)
  if (unread !== undefined) qc.setQueryData(["unread-notifications-count"], unread)

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <StudioLayoutClient initialRole={primary as StudioRole}>
        <RestrictionBanner initial={restriction} />
        <ConsentBanner initialPending={consent === undefined ? undefined : consent === "pending"} />
        {children}
      </StudioLayoutClient>
    </HydrationBoundary>
  )
}
