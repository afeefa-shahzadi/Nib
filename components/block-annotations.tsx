"use client"

import { useEffect, useState, useCallback } from "react"
import {
  listBlockAnnotations,
  createBlockAnnotation,
  deleteBlockAnnotation,
} from "@/actions/annotations"
import {
  upvoteAnnotation,
  removeUpvote,
  listAnnotationUpvotes,
} from "@/actions/monetization"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MessageSquarePlus, Trash2, ArrowUp } from "lucide-react"
import { toast } from "sonner"
import { BlockNote } from "@/lib/types/content"

export function BlockAnnotations({
  contentObjectId,
  blockIds,
  authed,
  currentUserId,
}: {
  contentObjectId: string
  blockIds: string[]
  authed: boolean
  currentUserId: string | null
}) {
  const listFn = listBlockAnnotations
  const addFn = createBlockAnnotation
  const delFn = deleteBlockAnnotation
  const upvoteFn = upvoteAnnotation
  const unvoteFn = removeUpvote
  const countsFn = listAnnotationUpvotes
  const [notes, setNotes] = useState<BlockNote[]>([])
  const [openBlock, setOpenBlock] = useState<string | null>(null)
  const [body, setBody] = useState("")
  const [upCounts, setUpCounts] = useState<Record<string, number>>({})
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set())

  const reload = useCallback(() => {
    listFn({ data: { content_object_id: contentObjectId } })
      .then(async (rows) => {
        const list = rows as BlockNote[]
        setNotes(list)
        if (list.length > 0) {
          const ids = list.map((n) => n.id)
          const c = await countsFn({ data: { annotationIds: ids } }).catch(
            () => ({ counts: {} as Record<string, number> })
          )
          setUpCounts(c.counts ?? {})
        }
      })
      .catch(() => {})
  }, [contentObjectId, listFn, countsFn])
  useEffect(() => {
    reload()
  }, [reload])

  const toggleVote = async (id: string) => {
    if (!authed) {
      toast.info("Sign in to upvote")
      return
    }
    const has = myVotes.has(id)
    const next = new Set(myVotes)
    if (has) {
      next.delete(id)
      setUpCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) - 1) }))
    } else {
      next.add(id)
      setUpCounts((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }))
    }
    setMyVotes(next)
    try {
      if (has) await unvoteFn({ data: { annotationId: id } })
      else await upvoteFn({ data: { annotationId: id } })
    } catch (e) {
      toast.error((e as Error).message)
      reload()
    }
  }

  const grouped = new Map<string, BlockNote[]>()
  for (const n of notes) {
    if (!grouped.has(n.block_id)) grouped.set(n.block_id, [])
    grouped.get(n.block_id)!.push(n)
  }

  const submit = async (blockId: string) => {
    if (!body.trim()) return
    try {
      await addFn({
        data: {
          content_object_id: contentObjectId,
          block_id: blockId,
          body: body.trim(),
        },
      })
      setBody("")
      setOpenBlock(null)
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const del = async (id: string) => {
    try {
      await delFn({ data: { id } })
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (notes.length === 0 && !authed) return null

  return (
    <section className="hairline-t mt-12 pt-6">
      <h2 className="mb-4 inline-flex items-center gap-2 font-display text-xl text-foreground">
        <MessageSquarePlus className="size-4 text-primary" /> Margin notes
      </h2>

      {blockIds.length > 0 && authed && (
        <div className="mb-4">
          <Select
            value={openBlock || "empty"}
            onValueChange={(v) => setOpenBlock(v === "empty" ? null : v)}
          >
            <SelectTrigger className="mr-2 h-8 w-40 rounded border border-input bg-background px-2 text-xs">
              <SelectValue placeholder="Add a note on…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="empty">Add a note on…</SelectItem>
              {blockIds.map((id, i) => (
                <SelectItem key={id} value={id}>
                  Block {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {openBlock && (
            <div className="mt-2 space-y-2">
              <Textarea
                rows={3}
                maxLength={1000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Your note…"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => submit(openBlock)}>
                  Post note
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setOpenBlock(null)
                    setBody("")
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="surface rounded-md p-4 text-sm">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleVote(n.id)}
                  className={`flex flex-col items-center gap-0.5 rounded px-2 py-1 transition ${
                    myVotes.has(n.id)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="Upvote annotation"
                >
                  <ArrowUp className="size-4" />
                  <span className="text-xs tabular-nums">
                    {upCounts[n.id] ?? 0}
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-xs text-muted-foreground">
                    {n.user ? `@${n.user.handle}` : "anon"} ·{" "}
                    {new Date(n.created_at).toLocaleDateString()}
                    {currentUserId === n.user_id && (
                      <button
                        onClick={() => del(n.id)}
                        className="ml-2 inline-flex items-center gap-1 text-destructive hover:underline"
                      >
                        <Trash2 className="size-3" /> delete
                      </button>
                    )}
                  </p>
                  <p className="whitespace-pre-wrap text-foreground/90">
                    {n.body}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
