/* eslint-disable @typescript-eslint/no-explicit-any */
import { SITE_URL } from "@/lib/brand"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { listRoomsForPiece } from "@/actions/debate"
import { isSaved } from "@/actions/content"
import { cachedRelatedPieces, cachedActiveBoosts, cachedClapStats, pieceBySlug } from "@/lib/public-cache"
import { getMyAccess } from "@/actions/payments"
import { tryGetViewerId } from "@/actions/content/helpers"
import { getMyProfile } from "@/actions/content"
import { getMyHighlights } from "@/actions/highlights"
import { listComments } from "@/actions/comments"
import { jsonLdHtml } from "@/lib/json-ld"
import { isLaunchFree } from "@/lib/plan"
import { ReaderClient } from "./reader-client"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ slug: string; handle: string }>
}) {
  const { slug } = await params
  const res = await pieceBySlug(slug)

  // Disabled by a copyright claim — show a transparency surface (to everyone)
  // and a counter-notice link (to the author) instead of a 404.
  if (res && "restricted" in res && res.restricted === "dmca") {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
        <div className="max-w-md space-y-4 text-center">
          <span className="mb-2 block text-5xl" aria-hidden="true">
            ⚖️
          </span>
          <h1 className="font-display text-3xl text-foreground">
            Removed following a copyright claim
          </h1>
          <p className="text-muted-foreground">
            This piece was disabled after we received a copyright claim. We review every
            claim before acting, and the author may file a counter-notice. This is not a
            judgment on the merits of the claim.
          </p>
          {res.isOwner && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button asChild>
                <Link href={`/dmca/counter/${res.noticeId}`}>File a counter-notice</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Owner pasted their own not-yet-public piece's URL — explain instead of 404.
  if (res && "restricted" in res) {
    const label =
      res.status === "scheduled"
        ? "scheduled to publish"
        : res.status === "published"
          ? "set to private"
          : "still a draft"
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
        <div className="max-w-md space-y-4 text-center">
          <span className="mb-2 block text-5xl" aria-hidden="true">
            🔒
          </span>
          <h1 className="font-display text-3xl text-foreground">
            Not public yet
          </h1>
          <p className="text-muted-foreground">
            This piece is {label}, so it isn’t visible at its public link. Only
            you can see this message — open it in the studio to keep editing or
            publish it.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button asChild>
              <Link href={`/studio/drafts/${res.pieceId}`}>Open in studio</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/studio/drafts">All pieces</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!res || !res.piece) {
    notFound()
  }

  const viewerId = await tryGetViewerId()

  const isFree = !res.blocks.some((b: Record<string, unknown>) => b.monetization_eligible === true)
  const shouldFetchBoosts = isFree && !res.piece.sponsorship_enabled

  const [rooms, related, boosts, accessData, savedData, profileData, highlights, allComments, clapStats] = await Promise.all([
    listRoomsForPiece({ data: { content_object_id: res.piece.id } }).catch(
      () => []
    ),
    cachedRelatedPieces(res.piece.id).catch(() => []),
    shouldFetchBoosts
      ? cachedActiveBoosts().catch(() => [])
      : Promise.resolve([]),
    viewerId
      ? getMyAccess().catch(() => ({ purchases: [], subscriptions: [] }))
      : Promise.resolve({ purchases: [], subscriptions: [] }),
    viewerId
      ? isSaved({ data: { content_object_id: res.piece.id } }).catch(() => ({
          saved: false,
        }))
      : Promise.resolve({ saved: false }),
    viewerId
      ? getMyProfile().catch(() => null)
      : Promise.resolve(null),
    viewerId
      ? getMyHighlights(res.piece.id).catch(() => [])
      : Promise.resolve([]),
    listComments({ data: { piece_id: res.piece.id } }).catch(() => []),
    // Guests show this cached total; signed-in readers load live counts client-side.
    viewerId ? Promise.resolve(null) : cachedClapStats(res.piece.id).catch(() => null),
  ])

  let isAdult = false
  let hasDob = false
  if (profileData?.date_of_birth) {
    hasDob = true
    const dob = new Date(profileData.date_of_birth as string)
    const age = new Date().getFullYear() - dob.getFullYear()
    isAdult = age >= 18
  }

  const launchFree = isLaunchFree()
  let hasAccess = launchFree || res.viewerHasAccess
  if (viewerId && accessData) {
    const ownsViaSub = (accessData.subscriptions as Record<string, unknown>[]).some(
      (s) => s.author_id === res.piece.author_id
    )
    const ownsViaPurchase = (accessData.purchases as Record<string, unknown>[]).some(
      (p) =>
        p.author_id === res.piece.author_id &&
        (p.content_object_id === res.piece.id || p.kind === "bundle")
    )
    hasAccess = hasAccess || ownsViaSub || ownsViaPurchase
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: res.piece.title,
    description: res.piece.summary || "",
    author: {
      "@type": "Person",
      name: res.author?.display_name || "Author",
      url: `${SITE_URL}/u/${res.author?.handle}`,
    },
    datePublished: res.piece.published_at || res.piece.created_at,
  }

  if (res.piece.is_nsfw && !isAdult) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
        <div className="text-center">
          <span className="text-6xl mb-4 block">🔞</span>
          <h1 className="font-display text-3xl mb-2 text-foreground">Content Restricted</h1>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            This piece has been marked as containing explicit content. 
            {hasDob 
              ? " You must be 18 or older to view this." 
              : " Please set your Date of Birth in your profile settings to confirm your age."}
          </p>
          <Button asChild variant="default">
            <Link href="/studio/settings">Update Settings</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />
      {/* Reserve the reader's space so the footer doesn't flash up before it hydrates (CLS). */}
      <Suspense fallback={<div className="min-h-screen" />}>
        <ReaderClient
          piece={res.piece}
          blocks={res.blocks}
          branches={res.branches}
          author={res.author}
          prev={res.prev}
          next={res.next}
          viewerHasAccess={hasAccess}
          launchFree={launchFree}
          isAdult={isAdult}
          hasDob={hasDob}
          initialRooms={rooms as any as Parameters<typeof ReaderClient>[0]["initialRooms"]}
          initialRelated={related as any as Parameters<typeof ReaderClient>[0]["initialRelated"]}
          initialBoosts={boosts as Record<string, unknown>[]}
          initialSaved={savedData.saved}
          initialHighlights={highlights}
          initialComments={allComments as any[]}
          guestClapTotal={clapStats?.total}
          originalPiece={res.originalPiece}
          originalAuthor={res.originalAuthor}
          originalBlocks={res.originalBlocks}
          commentSources={res.commentSources}
        />
      </Suspense>
    </>
  )
}
