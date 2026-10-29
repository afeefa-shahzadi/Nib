/* eslint-disable @typescript-eslint/no-explicit-any */
import { getMyRecommendations } from "@/actions/network"
import { NetworkClient, Recommendation } from "./network-client"

export const dynamic = "force-dynamic"

export default async function NetworkPage() {
  const recommendations = await getMyRecommendations()

  return (
    <div className="mx-auto w-full max-w-350 p-6 md:p-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Studio
          </p>
          <h1 className="font-display text-3xl text-foreground">
            Creator Network
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Endorse other creators. When a reader subscribes to you, they will
            be prompted to follow your network.
          </p>
        </div>
      </div>

      <NetworkClient
        initialRecommendations={recommendations as any as Recommendation[]}
      />
    </div>
  )
}
