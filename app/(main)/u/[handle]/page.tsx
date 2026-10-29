/* eslint-disable @typescript-eslint/no-explicit-any */
import { getAuthorByHandle } from "@/actions/content"
import { getProfileRecommendations } from "@/actions/network"
import { listCollectionsByCurator } from "@/actions/monetization/collections"
import AuthorClient from "./author-client"
import { notFound } from "next/navigation"
import { Piece, TierItem } from "@/lib/types/content"

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params

  const data = await getAuthorByHandle({ data: { handle } })
  if (!data) return notFound()

  const [recommendations, collections] = await Promise.all([
    getProfileRecommendations(handle),
    listCollectionsByCurator(data.author.id).catch(() => []),
  ])

  return (
    <AuthorClient
      author={data.author}
      pieces={data.pieces as any as Piece[]}
      tiers={data.tiers as any as TierItem[]}
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
