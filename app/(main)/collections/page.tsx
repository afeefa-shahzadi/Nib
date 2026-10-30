import Link from "next/link"
import { listPublicCollections, myCollections } from "@/actions/monetization"
import { createClient } from "@/lib/supabase/server"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { CollectionRow } from "@/lib/types/content"

const TYPE_LABEL: Record<string, string> = { list: "Reading list", course: "Course", playbook: "Playbook" }

export default async function CollectionsPage() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  const [rows, mine] = await Promise.all([
    listPublicCollections().catch(() => []) as Promise<CollectionRow[]>,
    user ? myCollections().catch(() => []) : Promise.resolve([]),
  ])

  return (
    <main className="container-wide pt-16 pb-16 md:pt-24 md:pb-24">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">Collections</h1>
          <p className="mt-4 max-w-[38rem] text-lg leading-relaxed text-muted-foreground">
            Reading lists, courses and playbooks, put together by readers and writers.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={user ? "/studio/collections" : "/signup"}>Make a collection</Link>
        </Button>
      </header>

      {mine.length > 0 && (
        <section className="mt-12" aria-labelledby="your-collections">
          <h2 id="your-collections" className="text-sm font-medium">Yours</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {mine.map((c: { id: string; title: string; is_public: boolean }) => (
              <li key={c.id}>
                <Link
                  href={`/collections/${c.id}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm hover:bg-accent lg:min-h-9"
                >
                  {c.title}
                  {!c.is_public && <span className="text-muted-foreground">· Private</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length === 0 ? (
        <div className="hairline-t hairline-b mt-12 py-12">
          <h2 className="font-display text-2xl">No public collections yet</h2>
          <p className="mt-2 max-w-[38rem] text-muted-foreground">
            Gather pieces you&apos;d recommend into a list, a course or a playbook, and share it.
          </p>
        </div>
      ) : (
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                href={`/collections/${c.id}`}
                className="group flex h-full flex-col rounded-lg border border-border p-5 transition-colors hover:border-foreground/20"
              >
                <p className="text-sm text-muted-foreground">
                  {TYPE_LABEL[c.collection_type ?? ""] ?? "Collection"} · {c.piece_count}{" "}
                  {c.piece_count === 1 ? "piece" : "pieces"}
                </p>
                <h2 className="mt-1 font-display text-xl leading-snug group-hover:text-primary">{c.title}</h2>
                {c.description && <p className="mt-2 line-clamp-2 text-muted-foreground">{c.description}</p>}
                {c.curator && (
                  <p className="mt-auto flex items-center gap-2 pt-4 text-sm">
                    <Avatar className="size-6">
                      {c.curator.avatar_url && <AvatarImage src={c.curator.avatar_url} alt="" />}
                      <AvatarFallback className="text-xs">{c.curator.display_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {c.curator.display_name}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
