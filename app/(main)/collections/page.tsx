"use client"

import { useEffect, useState } from "react"
import { listPublicCollections, myCollections } from "@/actions/monetization"
import { supabase } from "@/lib/supabase/client"
import { Library } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { CollectionRow } from "@/lib/types/content"

export default function CollectionsPage() {
  const fn = listPublicCollections
  const [rows, setRows] = useState<CollectionRow[]>([])
  const [mine, setMine] = useState<{ id: string; title: string; is_public: boolean }[]>([])
  useEffect(() => {
    fn()
      .then((res) => setRows(res as CollectionRow[]))
      .catch(() => {})
    // Signed-in readers' own lists (incl. the private "Saved" list) — the only
    // place to get back to what they saved.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) myCollections().then(setMine).catch(() => {})
    })
  }, [fn])

  return (
    <main className="container-wide pt-16 pb-16 md:pt-24">
      <header className="mb-10">
        <p className="inline-flex items-center gap-2 text-xs tracking-[0.25em] text-muted-foreground uppercase">
          <Library className="size-3.5" /> Curated reading
        </p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl">Collections</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Hand-picked reading paths by curators across Nib.
        </p>
      </header>

      {mine.length > 0 && (
        <section className="mb-12" aria-labelledby="your-collections">
          <h2 id="your-collections" className="mb-3 text-xs tracking-wider text-muted-foreground uppercase">
            Your collections
          </h2>
          <ul className="flex flex-wrap gap-2">
            {mine.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/collections/${c.id}`}
                  className="surface inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:border-border/60"
                >
                  {c.title}
                  {!c.is_public && (
                    <span className="text-xs text-muted-foreground">Private</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No collections yet. Be the first — head to Studio.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                href={`/collections/${c.id}`}
                className="surface block border-transparent p-4 transition-colors hover:border-border/60"
              >
                {c.cover_url && (
                  <Image
                    src={c.cover_url}
                    alt=""
                    width={800}
                    height={128}
                    className="mb-3 h-32 w-full rounded object-cover"
                  />
                )}
                <h2 className="font-display text-xl">{c.title}</h2>
                {c.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {c.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  by {c.curator?.display_name ?? "anon"}
                  {c.price_paise > 0 && (
                    <span className="ml-2 text-primary">
                      · ₹{c.price_paise / 100}
                    </span>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
