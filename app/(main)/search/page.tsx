import Link from "next/link"
import { Search as SearchIcon } from "lucide-react"
import { searchPieces, searchProfiles } from "@/actions/search"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PieceRow } from "@/components/piece-row"
import { Piece } from "@/lib/types/content"

type Person = { id: string; handle: string; display_name: string; avatar_url: string | null; bio: string | null }

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 200)
  const [pieces, people] = q
    ? await Promise.all([
        searchPieces({ data: { q } }).catch(() => []) as Promise<Piece[]>,
        searchProfiles({ data: { q } }).catch(() => []) as Promise<Person[]>,
      ])
    : [[], []]
  const none = q && pieces.length === 0 && people.length === 0

  return (
    <main className="container-wide pt-16 pb-16 md:pt-24 md:pb-24">
      <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">Search</h1>
      {/* A plain GET form: works without JavaScript and keeps results shareable. */}
      <form action="/search" role="search" className="relative mt-8 max-w-[38rem]">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          name="q"
          type="search"
          defaultValue={q}
          autoFocus={!q}
          aria-label="Search pieces and writers"
          placeholder="Search pieces and writers"
          className="h-12 pl-9 text-base lg:h-12"
        />
      </form>

      {!q && <p className="mt-6 text-muted-foreground">Find pieces by title or idea, and writers by name or handle.</p>}

      {none && (
        <div className="hairline-t hairline-b mt-12 py-12">
          <h2 className="font-display text-2xl">Nothing found for “{q}”</h2>
          <p className="mt-2 text-muted-foreground">
            Try fewer or different words, or{" "}
            <Link href="/feed" className="font-medium text-primary hover:underline hover:underline-offset-4">
              browse the feed
            </Link>
            .
          </p>
        </div>
      )}

      {q && !none && (
        <div className="mt-12 grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
          <section className="min-w-0 lg:col-span-8" aria-labelledby="pieces-heading">
            <h2 id="pieces-heading" className="mb-2 text-sm font-medium">
              {pieces.length} {pieces.length === 1 ? "piece" : "pieces"}
            </h2>
            {pieces.length === 0 ? (
              <p className="hairline-t hairline-b py-8 text-muted-foreground">No pieces match.</p>
            ) : (
              <ul>
                {pieces.map((p) => (
                  <PieceRow key={p.id} p={p} />
                ))}
              </ul>
            )}
          </section>
          <section className={`lg:col-span-4 ${people.length ? "order-first lg:order-none" : ""}`} aria-labelledby="people-heading">
            <h2 id="people-heading" className="mb-2 text-sm font-medium">
              {people.length} {people.length === 1 ? "writer" : "writers"}
            </h2>
            {people.length === 0 ? (
              <p className="hairline-t hairline-b py-8 text-muted-foreground">No writers match.</p>
            ) : (
              <ul>
                {people.map((u) => (
                  <li key={u.id} className="hairline-t last:hairline-b">
                    <Link href={`/u/${u.handle}`} className="group flex items-start gap-3 py-4">
                      <Avatar className="size-10">
                        {u.avatar_url && <AvatarImage src={u.avatar_url} alt="" />}
                        <AvatarFallback>{u.display_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0">
                        <span className="block font-medium group-hover:text-primary">{u.display_name}</span>
                        <span className="block text-sm text-muted-foreground">@{u.handle}</span>
                        {u.bio && <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{u.bio}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
