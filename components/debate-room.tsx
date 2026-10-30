/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import { useEffect, useRef, useState } from "react"
import { DEBATE_BLOCK_EVENT } from "@/lib/debate-block"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import {
  getRoomContext,
  listMessages,
  postMessage,
  setRoomSummary,
} from "@/actions/debate"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { DebateMessage } from "@/lib/types/content"
import {
  CommentEditor,
  type CommentEditorRef,
} from "@/components/composer/comment-editor"
import { sanitize } from "@/components/block-renderer"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Reply } from "lucide-react"

// Radix Select items can't use "", so the whole-piece choice gets a sentinel.
const WHOLE_PIECE = "__piece"
const PAGE = 10

type Stance = "for" | "against" | "comment" | "question"
const STANCE: Record<Stance, { label: string; cls: string }> = {
  for: { label: "For", cls: "bg-success/15 text-success" },
  against: { label: "Against", cls: "bg-destructive/15 text-destructive" },
  comment: { label: "Comment", cls: "bg-muted text-muted-foreground" },
  question: { label: "Question", cls: "bg-info/15 text-info" },
}

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return "now"
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 604800) return `${Math.floor(s / 86400)}d`
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  })
}

interface Props {
  roomId: string
  title: string
  prompt?: string | null
  authed: boolean
}

export function DebateRoom({ roomId, title, prompt, authed }: Props) {
  const [msgs, setMsgs] = useState<DebateMessage[]>([])
  const [body, setBody] = useState("")
  const [stance, setStance] = useState<Stance>("comment")
  const [showAll, setShowAll] = useState(false)
  const [now] = useState(() => Date.now())
  const [posting, setPosting] = useState(false)
  const [blocks, setBlocks] = useState<{ id: string; excerpt: string }[]>([])
  const [blockId, setBlockId] = useState("")
  const [summary, setSummary] = useState<string | null>(null)
  const [canEditSummary, setCanEditSummary] = useState(false)
  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState("")
  const excerptOf = (id?: string | null) =>
    id ? blocks.find((b) => b.id === id)?.excerpt : undefined
  const fetchMsgs = listMessages
  const send = postMessage
  const paraNo = (id: string) => blocks.findIndex((b) => b.id === id) + 1
  const endRef = useRef<HTMLDivElement | null>(null)
  const lastCount = useRef(0)
  const editorRef = useRef<CommentEditorRef>(null)
  const pathname = usePathname()

  useEffect(() => {
    let active = true
    fetchMsgs({ data: { room_id: roomId } }).then((r) => {
      if (active) setMsgs(r)
    })
    getRoomContext({ data: { room_id: roomId } })
      .then((c) => {
        if (!active) return
        setBlocks(c.blocks)
        setSummary(c.summary)
        setCanEditSummary(c.canEditSummary)
      })
      .catch(() => {})
    const channel = supabase
      .channel(`debate:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "debate_messages",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchMsgs({ data: { room_id: roomId } }).then(
            (r) => active && setMsgs(r)
          )
        }
      )
      .subscribe()
    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [roomId, fetchMsgs])

  useEffect(() => {
    const onPick = (e: Event) => {
      const d = (e as CustomEvent<{ roomId: string; blockId: string }>).detail
      if (d.roomId !== roomId) return
      setBlockId(d.blockId)
      editorRef.current?.focus()
    }
    window.addEventListener(DEBATE_BLOCK_EVENT, onPick)
    return () => window.removeEventListener(DEBATE_BLOCK_EVENT, onPick)
  }, [roomId])

  // Follow the conversation only when a reply arrives after the first load,
  // and only if the reader is already near the end.
  useEffect(() => {
    if (lastCount.current && msgs.length > lastCount.current) {
      const r = endRef.current?.getBoundingClientRect()
      if (r && r.top < window.innerHeight + 200)
        endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
    lastCount.current = msgs.length
  }, [msgs.length])

  async function submit() {
    if (!body.trim()) return
    setPosting(true)
    const currentBody = body.trim()
    const currentStance = stance
    const currentBlock = blockId || null

    // Optimistic update
    const tempId = crypto.randomUUID()
    setMsgs((prev) => [
      ...prev,
      {
        id: tempId,
        room_id: roomId,
        user_id: "optimistic",
        stance: currentStance,
        body: currentBody,
        block_id: currentBlock,
        created_at: new Date().toISOString(),
        author: { handle: null, display_name: "You" },
      },
    ])
    setBody("")
    setBlockId("")

    try {
      await send({
        data: {
          room_id: roomId,
          stance: currentStance,
          body: currentBody,
          block_id: currentBlock,
        },
      })
      // Subscription will automatically trigger fetchMsgs to overwrite this optimistic update
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : "Failed to post")
      // Revert optimistic update on failure
      setMsgs((prev) => prev.filter((m) => m.id !== tempId))
      setBody(currentBody)
    } finally {
      setPosting(false)
    }
  }

  async function saveSummary() {
    try {
      const r = await setRoomSummary({
        data: { room_id: roomId, summary: summaryDraft },
      })
      setSummary(r.summary)
      setEditingSummary(false)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const visible = showAll ? msgs : msgs.slice(-PAGE)
  const hidden = msgs.length - visible.length

  return (
    <section className="surface rounded-lg p-4 sm:p-6" aria-label={title}>
      <h3 className="font-display text-xl text-foreground">{title}</h3>
      {prompt && <p className="mt-1 text-sm text-muted-foreground">{prompt}</p>}

      {editingSummary ? (
        <div className="mt-4 space-y-2">
          <Textarea
            value={summaryDraft}
            onChange={(e) => setSummaryDraft(e.target.value)}
            maxLength={2000}
            rows={3}
            aria-label="Where the debate landed"
            placeholder="Where did this debate land?"
          />
          <div className="flex gap-2">
            <Button className="min-h-11" onClick={saveSummary}>
              Pin summary
            </Button>
            <Button
              className="min-h-11"
              variant="ghost"
              onClick={() => setEditingSummary(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : summary ? (
        <div className="mt-4 rounded-lg bg-muted/40 p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-foreground">Where it landed</p>
            {canEditSummary && (
              <Button
                variant="ghost"
                className="-my-2 -mr-2 min-h-11 text-muted-foreground"
                onClick={() => {
                  setSummaryDraft(summary)
                  setEditingSummary(true)
                }}
              >
                Edit
              </Button>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-foreground/90">
            {summary}
          </p>
        </div>
      ) : (
        canEditSummary &&
        msgs.length > 0 && (
          <Button
            variant="ghost"
            className="mt-2 -ml-3 min-h-11 text-primary"
            onClick={() => {
              setSummaryDraft("")
              setEditingSummary(true)
            }}
          >
            Pin a summary of where this landed
          </Button>
        )
      )}

      <div className="mt-6">
        {msgs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No replies yet. Start the argument.
          </p>
        )}
        {hidden > 0 && (
          <Button
            variant="ghost"
            className="mb-2 -ml-3 min-h-11 text-primary"
            onClick={() => setShowAll(true)}
          >
            Show {hidden} earlier {hidden === 1 ? "reply" : "replies"}
          </Button>
        )}
        <ol className="space-y-6">
          {visible.map((m, i) => {
            const excerpt = excerptOf(m.block_id)
            const sameAsPrev = i > 0 && visible[i - 1].block_id === m.block_id
            const st = STANCE[m.stance as Stance] ?? STANCE.comment
            const name = m.author?.display_name || m.author?.handle || "Someone"
            return (
              <li key={m.id} className="group flex gap-3">
                <Avatar className="size-8 shrink-0">
                  <AvatarImage src={m.author?.avatar_url || ""} alt="" />
                  <AvatarFallback className="text-xs">
                    {name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-sm">
                    {m.author?.handle ? (
                      <Link
                        href={`/u/${m.author.handle}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">
                        {name}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${st.cls}`}
                    >
                      {st.label}
                    </span>
                    <time
                      dateTime={m.created_at}
                      title={new Date(m.created_at).toLocaleString()}
                      className="text-xs text-muted-foreground"
                    >
                      {ago(m.created_at, now)}
                    </time>
                  </div>
                  {excerpt && m.block_id && !sameAsPrev && (
                    <a
                      href={`#block-${m.block_id}`}
                      className="mt-1 block truncate text-xs text-muted-foreground hover:text-foreground"
                    >
                      On ¶{paraNo(m.block_id)}: {excerpt}
                    </a>
                  )}
                  <div
                    className="prose prose-sm dark:prose-invert prose-p:my-1 mt-1 max-w-none text-foreground/90"
                    dangerouslySetInnerHTML={{ __html: sanitize(m.body) }}
                  />
                  {authed && m.author?.handle && (
                    <Button
                      variant="ghost"
                      className="-ml-3 min-h-11 text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                      onClick={() => {
                        const handle = m.author?.handle
                        if (handle)
                          editorRef.current?.insertMention(
                            handle,
                            m.author?.display_name || handle
                          )
                      }}
                    >
                      <Reply className="size-4" aria-hidden /> Reply
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
        <div ref={endRef} />
      </div>

      {authed ? (
        <div className="mt-6 space-y-3 border-t border-border pt-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <ToggleGroup
              type="single"
              value={stance}
              onValueChange={(v) => v && setStance(v as Stance)}
              aria-label="Your stance"
              className="rounded-md border border-border"
            >
              {(Object.keys(STANCE) as Stance[]).map((s) => (
                <ToggleGroupItem
                  key={s}
                  value={s}
                  className="min-h-11 flex-1 px-3"
                >
                  {STANCE[s].label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {blocks.length > 0 && (
              <Select
                value={blockId || WHOLE_PIECE}
                onValueChange={(v) => setBlockId(v === WHOLE_PIECE ? "" : v)}
              >
                <SelectTrigger
                  aria-label="What this reply is about"
                  className="min-h-11 w-full min-w-0 md:flex-1"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value={WHOLE_PIECE}>
                    About the whole piece
                  </SelectItem>
                  {blocks.map((b, i) => (
                    <SelectItem key={b.id} value={b.id}>
                      ¶{i + 1}:{" "}
                      {b.excerpt.length > 60
                        ? b.excerpt.slice(0, 60) + "…"
                        : b.excerpt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <CommentEditor
            ref={editorRef}
            value={body}
            onChange={(html) => setBody(html)}
            placeholder="Add to the debate…"
            onSubmit={submit}
            disabled={posting}
          />
          <div className="flex justify-end">
            <Button
              className="min-h-11"
              onClick={submit}
              disabled={posting || !body.trim() || body === "<p></p>"}
            >
              {posting ? "Posting…" : "Post"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          <Link
            href={`/login?redirect=${pathname || "/"}`}
            className="text-primary hover:underline"
          >
            Sign in
          </Link>{" "}
          to join the debate.
        </p>
      )}
    </section>
  )
}
