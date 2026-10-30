/* eslint-disable @typescript-eslint/no-explicit-any */
import { cachedAuthorByHandle, cachedProfileRecommendations, cachedCollectionsByCurator } from "@/lib/public-cache"
import AuthorClient from "./author-client"
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

  const [recommendations, collections] = await Promise.all([
    cachedProfileRecommendations(handle),
    cachedCollectionsByCurator(data.author.id).catch(() => []),
  ])

  return (
    <AuthorClient
      author={data.author}
      pieces={data.pieces as any as Piece[]}
      tiers={data.tiers as any as TierItem[]}
      paymentsOpen={!isLaunchFree()}
      collections={collections}
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
