/* eslint-disable @typescript-eslint/no-explicit-any */
import { cachedAuthorByHandle, cachedProfileRecommendations, cachedCollectionsByCurator, cachedClappedPieces } from "@/lib/public-cache"
import AuthorClient from "./author-client"
import { listPublicBundles } from "@/actions/content/bundles"
import { notFound } from "next/navigation"
import { isLaunchFree } from "@/lib/plan"
import { Piece, TierItem } from "@/lib/types/content"

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params

  const data = await cachedAuthorByHandle(handle)
  if (!data) return notFound()

  const [recommendations, collections, clapped, bundles] = await Promise.all([
    cachedProfileRecommendations(handle),
    cachedCollectionsByCurator(data.author.id).catch(() => []),
    cachedClappedPieces(data.author.id).catch(() => []),
    listPublicBundles(data.author.id).catch(() => []),
  ])

  return (
    <AuthorClient
      author={data.author}
      pieces={data.pieces as any as Piece[]}
      tiers={data.tiers as any as TierItem[]}
      followers={data.followers ?? 0}
      following={data.following ?? 0}
      paymentsOpen={!isLaunchFree()}
      collections={collections}
      bundles={bundles}
      clapped={clapped as any as Piece[]}
      recommendations={
        recommendations as any as Array<{
          id: string
          blurb: string | null
          profiles: {
            display_name: string
            handle: string
            avatar_url: string | null
          }
        }>
      }
    />
  )
}
