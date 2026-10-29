/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { listMessages, postMessage } from "@/actions/debate"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { DebateMessage } from "@/lib/types/content"
import { CommentEditor, type CommentEditorRef } from "@/components/composer/comment-editor"
import { sanitize } from "@/components/block-renderer"

interface Props {
  roomId: string
  title: string
  prompt?: string | null
  authed: boolean
}

export function DebateRoom({ roomId, title, prompt, authed }: Props) {
  const [msgs, setMsgs] = useState<DebateMessage[]>([])
  const [body, setBody] = useState("")
  const [stance, setStance] = useState<
    "for" | "against" | "comment" | "question"
  >("comment")
  const [posting, setPosting] = useState(false)
  const fetchMsgs = listMessages
  const send = postMessage
  const containerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<CommentEditorRef>(null)
  const pathname = usePathname()

  useEffect(() => {
    let active = true
    fetchMsgs({ data: { room_id: roomId } }).then((r) => {
      if (active) setMsgs(r)
    })
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
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      })
    }
  }, [msgs.length])

  async function submit() {
    if (!body.trim()) return
    setPosting(true)
    const currentBody = body.trim()
    const currentStance = stance

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
        created_at: new Date().toISOString(),
        author: { handle: "you", display_name: "You" },
      },
    ])
    setBody("")

    try {
      await send({
        data: { room_id: roomId, stance: currentStance, body: currentBody },
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

  return (
    <div className="surface rounded-md p-5">
      <p className="text-xs tracking-wider text-primary uppercase">Debate</p>
      <p className="mt-1 font-display text-xl text-foreground">{title}</p>
      {prompt && <p className="mt-2 text-sm text-muted-foreground">{prompt}</p>}

      <div
        ref={containerRef}
        className="hairline-t mt-4 max-h-80 space-y-3 overflow-y-auto pt-3"
      >
        {msgs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Be the first to speak.
          </p>
        )}
        {msgs.map((m) => (
          <div key={m.id} className="text-sm group relative">
            <div className="flex items-center gap-2">
              <span className="text-xs tracking-wider text-primary uppercase">
                {m.stance}
              </span>
              <span className="text-xs text-muted-foreground">
                {m.author ? (
                  <Link
                    href={`/u/${m.author.handle}`}
                    className="hover:text-primary hover:underline"
                  >
                    @{m.author.handle}
                  </Link>
                ) : (
                  "anon"
                )}{" "}
                · {new Date(m.created_at).toLocaleTimeString()}
              </span>
              {authed && m.author && (
                <button
                  onClick={() => {
                    const handle = m.author?.handle
                    const name = m.author?.display_name
                    if (editorRef.current && handle && name) {
                      editorRef.current.insertMention(handle, name)
                    }
                  }}
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  title="Reply"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"></polyline><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path></svg>
                  Reply
                </button>
              )}
            </div>
            <div
              className="mt-1 whitespace-pre-wrap text-foreground/90 prose prose-sm dark:prose-invert max-w-none prose-p:my-1"
              dangerouslySetInnerHTML={{ __html: sanitize(m.body) }}
            />
          </div>
        ))}
      </div>

      {authed ? (
        <div className="mt-4 space-y-2">
          <div className="flex gap-1">
            {(["for", "against", "comment", "question"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStance(s)}
                className={`rounded px-2 py-1 text-xs tracking-wider uppercase ${stance === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {s}
              </button>
            ))}
          </div>
          <CommentEditor
            ref={editorRef}
            value={body}
            onChange={(html) => setBody(html)}
            placeholder="Add to the debate…"
            onSubmit={submit}
            disabled={posting}
          />
          <Button size="sm" onClick={submit} disabled={posting || !body.trim() || body === "<p></p>"}>
            {posting ? "Posting…" : "Post"}
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          <Link
            href={`/login?redirect=${pathname || "/"}`}
            className="text-primary hover:underline"
          >
            Sign in
          </Link>{" "}
          to join the debate.
        </p>
      )}
    </div>
  )
}
