"use client"

import { useParams } from "next/navigation"
import { notFound } from "next/navigation"
import { useEffect, useState } from "react"
import { getCollection } from "@/actions/monetization"
import Link from "next/link"
import Image from "next/image"
import { CheckCircle2, Circle } from "lucide-react"

type Data = Awaited<ReturnType<typeof getCollection>>

const COLLECTION_LABEL: Record<string, string> = {
  list: "Reading List",
  course: "Course",
  playbook: "Playbook",
}

export default function CollectionDetail() {
  const { id } = useParams()
  const [d, setD] = useState<Data | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, boolean>>({})

  useEffect(() => {
    getCollection({ data: { id } })
      .then((res) => {
        setD(res)
        // Load local progress
        const saved = localStorage.getItem(`bundle_progress_${id}`)
        if (saved) {
          try {
            setProgress(JSON.parse(saved))
          } catch {}
        }
      })
      .catch((e: Error) => setErr(e.message))
  }, [id])

  const toggleProgress = (pieceId: string) => {
    const next = { ...progress, [pieceId]: !progress[pieceId] }
    setProgress(next)
    localStorage.setItem(`bundle_progress_${id}`, JSON.stringify(next))
  }

  if (err) throw notFound()
  if (!d)
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>

  return (
    <main className="mx-auto max-w-3xl px-6 pt-16 pb-16 md:pt-24">
      {d.collection.cover_url && (
        <div className="relative mb-6 h-56 w-full overflow-hidden rounded-lg">
          <Image
            src={d.collection.cover_url}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
            priority
          />
        </div>
      )}
      <div className="flex items-center gap-3">
        <h1 className="font-display text-4xl">{d.collection.title}</h1>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs tracking-wider text-primary uppercase">
          {COLLECTION_LABEL[d.collection.collection_type] ?? "Collection"}
        </span>
      </div>
      {d.collection.description && (
        <p className="mt-3 text-muted-foreground">{d.collection.description}</p>
      )}
      <p className="mt-4 text-sm text-muted-foreground">
        Curated by @{d.curator?.handle}
      </p>

      {d.pieces.length === 0 && (
        <p className="mt-10 rounded-md border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          No pieces in this collection yet.
        </p>
      )}

      <ol className="mt-10 space-y-4">
        {d.pieces.map((p, i) => {
          const isCompleted = !!progress[p.id]
          return (
            <li
              key={p.id}
              className={`surface flex items-start gap-4 rounded-md p-5 transition-colors ${
                isCompleted ? "opacity-70" : ""
              }`}
            >
              <button
                onClick={() => toggleProgress(p.id)}
                className="mt-1 shrink-0 text-muted-foreground hover:text-primary"
                title={isCompleted ? "Mark as unread" : "Mark as completed"}
              >
                {isCompleted ? (
                  <CheckCircle2 className="size-6 text-primary" />
                ) : (
                  <Circle className="size-6" />
                )}
              </button>
              <div className="flex-1">
                <div className="text-xs tracking-wider text-muted-foreground uppercase">
                  Module {i + 1}
                </div>
                <h2
                  className={`mt-1 font-display text-xl ${isCompleted ? "line-through" : ""}`}
                >
                  <Link
                    href={`/u/${p.author_handle ?? d.curator?.handle ?? ""}/${p.slug}?via=${id}`}
                    className="no-underline hover:text-primary"
                  >
                    {p.title}
                  </Link>
                </h2>
                {p.summary && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.summary}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </main>
  )
}
