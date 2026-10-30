import Link from "next/link"
import { notFound } from "next/navigation"
import { getCollection } from "@/actions/monetization"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ReadingList } from "./reading-list"

const TYPE_LABEL: Record<string, string> = { list: "Reading list", course: "Course", playbook: "Playbook" }

export default async function CollectionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const d = await getCollection({ data: { id } }).catch(() => null)
  if (!d) notFound()
  const { collection: c, curator } = d

  const items = d.pieces.map((p) => ({
    id: p.id,
    title: p.title,
    summary: p.summary,
    // ?via= credits this collection's curator if the piece is later bought.
    href: `/u/${p.author_handle ?? curator?.handle ?? ""}/${p.slug}?via=${id}`,
  }))

  return (
    <main className="container-wide grid items-start gap-10 pt-16 pb-16 md:pt-24 md:pb-24 lg:grid-cols-12 lg:gap-12">
      <div className="lg:sticky lg:top-24 lg:col-span-5">
        <p className="text-sm text-muted-foreground">
          {TYPE_LABEL[c.collection_type] ?? "Collection"} · {items.length} {items.length === 1 ? "piece" : "pieces"}
          {!c.is_public && " · Private"}
        </p>
        <h1 className="mt-2 font-display text-4xl leading-[1.05] sm:text-5xl">{c.title}</h1>
        {c.description && <p className="mt-4 text-lg leading-relaxed text-foreground/85">{c.description}</p>}
        {curator && (
          <Link
            href={`/u/${curator.handle}`}
            className="mt-6 -my-1.5 inline-flex min-h-11 items-center gap-3 py-1.5 hover:text-primary"
          >
            <Avatar className="size-8">
              {curator.avatar_url && <AvatarImage src={curator.avatar_url} alt="" />}
              <AvatarFallback>{curator.display_name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-sm">
              <span className="text-muted-foreground">Curated by </span>
              {curator.display_name}
            </span>
          </Link>
        )}
      </div>

      <div className="lg:col-span-7">
        {items.length === 0 ? (
          <p className="hairline-t hairline-b py-12 text-muted-foreground">No pieces in this collection yet.</p>
        ) : (
          <ReadingList collectionId={id} items={items} />
        )}
      </div>
    </main>
  )
}
