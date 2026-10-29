"use client"

import { useQuery } from "@tanstack/react-query"
import { getMyAuthorGraph } from "@/actions/debate"
import { getMyProfile } from "@/actions/content"
import { RelationshipGraph } from "@/components/relationship-graph"

export default function GraphPage() {
  const getGraphFn = getMyAuthorGraph
  const getProfileFn = getMyProfile

  const profileQ = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getProfileFn(),
  })

  const graphQ = useQuery({
    queryKey: ["my-graph"],
    queryFn: () => getGraphFn(),
  })

  const handle = profileQ.data?.handle ?? "creator"

  return (
    <div className="mx-auto w-full max-w-350 p-6 md:p-8">
      <div className="mb-6">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
          Studio
        </p>
        <h1 className="font-display text-3xl text-foreground">Content Graph</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visual mapping of your published pieces and alternate branch framings.
        </p>
      </div>

      {/* Only gate on the graph query; the profile is just for the handle label
          (has a fallback), so a slow/failed profile fetch must not block the graph. */}
      {graphQ.isLoading ? (
        <div className="surface rounded-md p-8 text-center text-sm text-muted-foreground">
          Loading graph data...
        </div>
      ) : graphQ.data ? (
        <RelationshipGraph
          handle={handle}
          pieces={graphQ.data.pieces}
          branches={graphQ.data.branches}
          relationships={graphQ.data.relationships}
        />
      ) : (
        <div className="surface rounded-md p-8 text-center text-sm text-muted-foreground">
          Could not load content graph.
        </div>
      )}
    </div>
  )
}
