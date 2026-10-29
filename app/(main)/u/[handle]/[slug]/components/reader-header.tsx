import Link from "next/link"
import { Clock } from "lucide-react"
import { PieceData, AuthorData } from "@/lib/types/content"
import { ReadingMode } from "@/components/block-renderer"

interface ReaderHeaderProps {
  piece: PieceData
  author: AuthorData | null
  minutes: number
  mode: ReadingMode
}

export function ReaderHeader({
  piece,
  author,
  minutes,
  mode,
}: ReaderHeaderProps) {
  return (
    <>
      <p className="flex items-center text-xs tracking-[0.2em] text-primary uppercase">
        {author && (
          <Link href={`/u/${author.handle}`} className="inline-flex min-h-11 items-center hover:text-foreground sm:min-h-0">
            @{author.handle}
          </Link>
        )}
        <span className="mx-2 text-muted-foreground/60">·</span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Clock className="size-3" aria-hidden /> {minutes} min · {mode}
        </span>
      </p>
      <h1 className="mt-3 font-display text-5xl leading-[1.05] text-foreground md:text-6xl">
        {piece.title}
      </h1>
      {piece.summary && (
        <p className="mt-5 text-lg text-muted-foreground">{piece.summary}</p>
      )}
      {piece.canonical_thesis && (
        <p className="mt-6 border-l-2 border-primary pl-5 font-display text-xl text-foreground/85 italic">
          {piece.canonical_thesis}
        </p>
      )}
      {piece.source_url && (
        <p className="mt-4 text-sm text-muted-foreground">
          Originally published at{" "}
          <a
            href={piece.source_url}
            target="_blank"
            rel="canonical noopener noreferrer"
            className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-foreground sm:min-h-0"
          >
            {sourceLabel(piece.source_url)}
          </a>
        </p>
      )}
    </>
  )
}

// Show the source host (e.g. "medium.com") rather than a long slug URL.
function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}
