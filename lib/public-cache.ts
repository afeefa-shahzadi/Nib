import { unstable_cache } from "next/cache"
import { authorLeaderboard, pieceLeaderboard, readerLeaderboard, type Timeframe } from "@/actions/leaderboard"
import { cache } from "react"
import { getAuthorByHandle, getPieceBySlug, getRelatedPieces } from "@/actions/content"
import { getDiscoverFeed } from "@/actions/social"
import { listActiveBoosts } from "@/actions/monetization/payments"
import { getProfileRecommendations } from "@/actions/network"
import { listCollectionsByCurator } from "@/actions/monetization/collections"

// Viewer-independent reads (service-role client, no cookies) shared by every
// visitor of a public page. Pages stay dynamic for per-viewer state; these
// queries hit the DB at most once a minute per key instead of per request.
// ponytail: time-based only; add revalidateTag("public") on publish/profile edit if 60s staleness bites.
const opts = { revalidate: 60, tags: ["public"] }

export const cachedDiscoverFeed = unstable_cache(() => getDiscoverFeed(), ["discover-feed"], opts)
export const cachedAuthorByHandle = unstable_cache((handle: string) => getAuthorByHandle({ data: { handle } }), ["author-by-handle"], opts)
export const cachedRelatedPieces = unstable_cache((piece_id: string) => getRelatedPieces({ data: { piece_id } }), ["related-pieces"], opts)
export const cachedActiveBoosts = unstable_cache(() => listActiveBoosts(), ["active-boosts"], opts)
export const cachedProfileRecommendations = unstable_cache((handle: string) => getProfileRecommendations(handle), ["profile-recs"], opts)
export const cachedCollectionsByCurator = unstable_cache((id: string) => listCollectionsByCurator(id), ["collections-by-curator"], opts)

// Per-request dedupe (viewer-dependent, so not cross-request): the reader's
// layout metadata and page both load the same piece.
export const pieceBySlug = cache((slug: string) => getPieceBySlug({ data: { slug } }))
export const cachedAuthorLeaderboard = unstable_cache((timeframe: Timeframe) => authorLeaderboard({ data: { timeframe } }), ["lb-author"], opts)
export const cachedPieceLeaderboard = unstable_cache((timeframe: Timeframe) => pieceLeaderboard({ data: { timeframe } }), ["lb-piece"], opts)
export const cachedReaderLeaderboard = unstable_cache((timeframe: Timeframe) => readerLeaderboard({ data: { timeframe } }), ["lb-reader"], opts)
