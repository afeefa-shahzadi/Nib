import Link from "next/link"
import { Sparkles } from "lucide-react"
import { useMemo } from "react"

type BoostAdAuthor = { display_name?: string; handle?: string }
type BoostAdPiece = {
  title?: string
  slug?: string
  profiles?: BoostAdAuthor | null
}
type BoostAd = { content_objects?: BoostAdPiece | null }

export function PlatformBoostAd({
  boosts,
}: {
  boosts: Record<string, unknown>[]
}) {
  const ad = useMemo(() => {
    if (!boosts || boosts.length === 0) return null
    // Avoid impure function Math.random() during render to satisfy React guidelines
    return boosts[0] as BoostAd
  }, [boosts])

  if (!ad || !ad.content_objects) return null

  const piece = ad.content_objects
  const author = piece.profiles

  return (
    <div className="surface relative my-12 overflow-hidden rounded-xl border border-primary/20 bg-linear-to-br from-background to-primary/5 p-6">
      <div className="pointer-events-none absolute top-0 right-0 p-3 opacity-20">
        <Sparkles className="size-24 text-primary" />
      </div>

      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Sparkles className="size-3" /> Promoted
      </p>

      <h3 className="mb-1 font-display text-2xl text-foreground">
        {piece.title}
      </h3>

      <p className="mb-4 text-sm text-muted-foreground">
        By {author?.display_name || "Author"}
      </p>

      <Link
        href={`/u/${author?.handle}/${piece.slug}`}
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
      >
        Read now →
      </Link>
    </div>
  )
}
