import Link from "next/link"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Piece } from "@/lib/types/content"

// One piece in a list (feed, search): author, date, title, summary, tags, cover.
const date = (iso: string) =>
  // Pinned locale + UTC keeps SSR and client output identical.
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

export function PieceRow({ p }: { p: Piece }) {
  const a = p.author
  return (
    <li className="hairline-t last:hairline-b">
      <Link href={`/u/${a?.handle ?? "_"}/${p.slug}`} className="group flex gap-5 py-6">
        <article className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {a && (
              <span className="inline-flex items-center gap-2 text-foreground">
                <Avatar className="size-6">
                  {a.avatar_url && <AvatarImage src={a.avatar_url} alt="" />}
                  <AvatarFallback className="text-xs">{a.display_name.charAt(0)}</AvatarFallback>
                </Avatar>
                {a.display_name}
              </span>
            )}
            {p.published_at && <span>· {date(p.published_at)}</span>}
            {p.boosted && <span className="rounded-sm bg-muted px-1.5 text-xs">Promoted</span>}
          </div>
          <h2 className="mt-2 font-display text-xl leading-snug group-hover:text-primary">{p.title}</h2>
          {p.summary && <p className="mt-1 line-clamp-2 text-muted-foreground">{p.summary}</p>}
          {p.tags && p.tags.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">{p.tags.slice(0, 3).join(" · ")}</p>
          )}
        </article>
        {p.cover_image_url && (
          <Image
            src={p.cover_image_url}
            alt=""
            width={128}
            height={128}
            unoptimized={!p.cover_image_url.includes("supabase.co")}
            className="size-20 shrink-0 rounded-md border border-border object-cover sm:size-28"
          />
        )}
      </Link>
    </li>
  )
}
