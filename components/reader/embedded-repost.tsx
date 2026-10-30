/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link"
import { ReaderBody, type Block } from "@/components/block-renderer"
import { PieceData, AuthorData } from "@/lib/types/content"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function EmbeddedRepost({
  piece,
  author,
  blocks,
}: {
  piece: PieceData
  author: AuthorData | null
  blocks: any[]
}) {
  if (!piece) return null

  return (
    <div className="mt-8 overflow-hidden rounded-xl border border-border/50 bg-accent/20 p-6">
      <div className="mb-6 flex items-center gap-3">
        {author && (
          <Link href={`/u/${author.handle}`} className="block shrink-0">
            <Avatar className="size-8 ring-1 ring-border">
              <AvatarImage
                src={author.avatar_url || ""}
                alt={author.display_name}
              />
              <AvatarFallback className="text-xs">
                {author.display_name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
        )}
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-medium text-foreground">
              {author?.display_name ?? "Unknown Author"}
            </span>
            <span className="text-xs text-muted-foreground">
              Reposted
            </span>
          </div>
          <Link
            href={`/u/${author?.handle}/${piece.slug}`}
            className="mt-0.5 truncate font-display text-lg text-foreground hover:underline"
          >
            {piece.title}
          </Link>
        </div>
      </div>
      <div className="w-[105.26%] origin-top-left scale-95 text-muted-foreground">
        <ReaderBody
          blocks={blocks as Block[]}
          mode="standard"
          hasAccess={true}
        />
      </div>
    </div>
  )
}
