"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { searchPieces } from "@/actions/search"
import { Input } from "@/components/ui/input"
import { Search as SearchIcon } from "lucide-react"
import { useState } from "react"
import Link from "next/link"

function SearchPageContent() {
  const searchParams = useSearchParams()
  const initialQ = searchParams?.get("q") ?? ""
  const nav = useRouter()
  const [q, setQ] = useState(initialQ)
  const fetchFn = searchPieces
  const query = useQuery({
    queryKey: ["search", initialQ],
    queryFn: () => fetchFn({ data: { q: initialQ } }),
    enabled: initialQ.trim().length > 0,
  })

  const onSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    nav.push(`/search?q=${q.trim()}`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="container-wide max-w-3xl flex-1 pt-16 pb-12 md:pt-24">
        <h1 className="mb-6 font-display text-4xl text-foreground">Search</h1>
        <form onSubmit={onSubmit} className="relative mb-8">
          <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search titles, ideas, tags…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-12 pl-9 text-base"
          />
        </form>

        {!initialQ && (
          <p className="text-muted-foreground">Type a query above to search.</p>
        )}
        {initialQ && query.isLoading && (
          <p className="text-muted-foreground">Searching…</p>
        )}
        {initialQ && !query.isLoading && (query.data ?? []).length === 0 && (
          <p className="text-muted-foreground">
            No matches for &quot;{initialQ}&quot;.
          </p>
        )}

        <ul className="space-y-5">
          {(query.data ?? []).map((p) => (
            <li
              key={p.id}
              className="surface rounded-md p-5 transition-colors hover:bg-accent/30"
            >
              <p className="mb-1 text-xs tracking-wider text-primary uppercase">
                {p.author ? `@${p.author.handle}` : "—"}
              </p>
              {p.author ? (
                <Link
                  href={`/u/${p.author.handle}/${p.slug}`}
                  className="font-display text-xl text-foreground hover:text-primary"
                >
                  {p.title}
                </Link>
              ) : (
                <span className="font-display text-xl text-foreground">
                  {p.title}
                </span>
              )}
              {p.summary && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {p.summary}
                </p>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SearchPageContent />
    </Suspense>
  )
}
