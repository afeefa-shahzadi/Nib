import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FollowButton } from "@/components/follow-button"
import { PieceData, AuthorData } from "@/lib/types/content"
import { ReadingMode } from "@/components/block-renderer"

interface ReaderHeaderProps {
  piece: PieceData
  author: AuthorData | null
  minutes: number
  mode: ReadingMode
  isAuthor?: boolean
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
// Edits within a day of publishing are proofreading, not an update worth flagging.
const wasUpdated = (pub?: string | null, upd?: string | null) =>
  !!pub && !!upd && new Date(upd).getTime() - new Date(pub).getTime() > 86_400_000

export function ReaderHeader({
  piece,
  author,
  minutes,
  mode,
  isAuthor,
}: ReaderHeaderProps) {
  const topic = piece.tags?.[0]
  return (
    <>
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
        {topic && (
          <Link href={`/feed?tag=${encodeURIComponent(topic)}`} className="inline-flex min-h-11 items-center text-primary capitalize hover:underline sm:min-h-0">
            {topic}
          </Link>
        )}
        {topic && <span aria-hidden>·</span>}
        <span>
          {minutes} min read{mode !== "standard" && ` · ${mode} mode`}
        </span>
        {piece.published_at && (
          <>
            <span aria-hidden>·</span>
            <time dateTime={piece.published_at}>{day(piece.published_at)}</time>
          </>
        )}
        {wasUpdated(piece.published_at, piece.updated_at) && (
          <>
            <span aria-hidden>·</span>
            <span>
              Updated <time dateTime={piece.updated_at!}>{day(piece.updated_at!)}</time>
            </span>
          </>
        )}
        {piece.is_ai_generated && (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Sparkles className="size-3.5" aria-hidden /> Made with AI
            </span>
          </>
        )}
      </p>
      <h1 className="mt-3 font-display text-5xl leading-[1.05] text-foreground md:text-6xl">
        {piece.title}
      </h1>
      {piece.summary && (
        <p className="mt-5 text-lg text-muted-foreground">{piece.summary}</p>
      )}
      {author && (
        <div className="mt-6 flex items-center gap-3">
          <Link href={`/u/${author.handle}`} className="flex min-w-0 items-center gap-3 hover:text-primary">
            <Avatar className="size-10">
              {author.avatar_url && <AvatarImage src={author.avatar_url} alt="" />}
              <AvatarFallback>{author.display_name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <span className="block truncate font-medium">{author.display_name}</span>
              <span className="block truncate text-sm text-muted-foreground">@{author.handle}</span>
            </span>
          </Link>
          {!isAuthor && (
            <FollowButton authorId={piece.author_id} authorHandle={author.handle} size="sm" className="ml-auto" />
          )}
        </div>
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
