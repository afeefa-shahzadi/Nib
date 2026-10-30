/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect, useRef } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { listComments, postComment } from "@/actions/comments"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import Link from "next/link"
import { sanitize } from "./block-renderer"
import dynamic from "next/dynamic"
import type { CommentEditorRef } from "./composer/comment-editor"
// Lazy: tiptap/prosemirror (~390KB) only loads when the comments sheet opens.
const CommentEditor = dynamic(() => import("./composer/comment-editor").then((m) => m.CommentEditor), { ssr: false })
import { BookOpen } from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"
import { COMMENTS_PAGE } from "@/lib/comments"

import { CommentActions, type CommentData } from "./comment-actions"

// Oldest unpinned comment loaded so far: the cursor for "Load older".
const oldestUnpinned = (list: CommentData[]) =>
  list.filter((c) => !c.is_pinned).reduce<string | undefined>((min, c) => (!min || c.created_at < min ? c.created_at : min), undefined)

// A refresh returns page 1 only. Keep older pages already loaded (those past
// page 1's oldest unpinned comment) instead of dropping them.
const withFirstPage = (fresh: CommentData[]) => (prev: CommentData[]) => {
  if (fresh.length < COMMENTS_PAGE) return fresh
  const cutoff = oldestUnpinned(fresh)!
  return [...fresh, ...prev.filter((c) => !c.is_pinned && c.created_at < cutoff)]
}

export function CommentsSheet({
  pieceId,
  open,
  onOpenChange,
  authed,
  viewerId,
  pieceAuthorId,
  focusId,
}: {
  pieceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  authed: boolean
  viewerId?: string | null
  pieceAuthorId?: string | null
  focusId?: string | null // scroll to and highlight this response once loaded
}) {
  const [comments, setComments] = useState<CommentData[]>([])
  const [loading, setLoading] = useState(false)
  const [prevOpen, setPrevOpen] = useState(open)
  const [body, setBody] = useState("")
  const [posting, setPosting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  
  const [hasOlder, setHasOlder] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)

  const editorRef = useRef<CommentEditorRef>(null)

  async function loadOlder() {
    const before = oldestUnpinned(comments)
    if (!before) return
    setLoadingOlder(true)
    try {
      const older = (await listComments({ data: { piece_id: pieceId, before } })) as any as CommentData[]
      const ids = new Set(comments.map((c) => c.id))
      setComments((prev) => [...prev, ...older.filter((c) => !ids.has(c.id))])
      setHasOlder(older.length >= COMMENTS_PAGE)
    } catch {
      toast.error("Couldn't load older responses")
    } finally {
      setLoadingOlder(false)
    }
  }

  const [focused, setFocused] = useState<string | null>(null)
  // Not on the first page: fetch that response (and its parent) and add it.
  const [fetchedFocus, setFetchedFocus] = useState<string | null>(null)
  useEffect(() => {
    if (!open || loading || !focusId || fetchedFocus === focusId || comments.some((c) => c.id === focusId)) return
    let active = true
    listComments({ data: { piece_id: pieceId, focus: focusId } })
      .then((rows) => {
        if (!active) return
        setFetchedFocus(focusId)
        setComments((cur) => [...cur, ...(rows as any as CommentData[]).filter((r) => !cur.some((c) => c.id === r.id))])
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [open, loading, focusId, fetchedFocus, comments, pieceId])
  useEffect(() => {
    if (!open || !focusId || focused === focusId) return
    if (!comments.some((c) => c.id === focusId)) return
    const t = setTimeout(() => {
      const el = document.getElementById(`response-${focusId}`)
      el?.scrollIntoView({ block: "center", behavior: "smooth" })
      setFocused(focusId)
    }, 150)
    return () => clearTimeout(t)
  }, [open, focusId, focused, comments])

  // Keep the focused reply's thread open.
  const focusParent = focusId ? comments.find((c) => c.id === focusId)?.parent_id : null

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setLoading(true)
    }
  }

  useEffect(() => {
    let active = true
    let refetch: ReturnType<typeof setTimeout> | undefined
    if (open) {
      listComments({ data: { piece_id: pieceId } })
        .then((data) => {
          if (!active) return
          setComments(data as any as CommentData[])
          setHasOlder(data.length >= COMMENTS_PAGE)
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false)
        })
        
      const channel = supabase
        .channel(`comments:${pieceId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "piece_responses",
            filter: `piece_id=eq.${pieceId}`,
          },
          () => {
            // Every open sheet refetches on each insert; coalesce bursts and
            // spread viewers out so a busy piece isn't hit by all at once.
            if (refetch) return
            refetch = setTimeout(() => {
              refetch = undefined
              listComments({ data: { piece_id: pieceId } }).then((data) => {
                if (active) setComments(withFirstPage(data as any as CommentData[]))
              })
            }, 1500 + Math.random() * 1500)
          }
        )
        .subscribe()
        
      return () => {
        active = false
        clearTimeout(refetch)
        supabase.removeChannel(channel)
      }
    }
  }, [open, pieceId])

  async function submit() {
    if (!body.trim()) return
    setPosting(true)
    const val = body.trim()
    try {
      await postComment({ data: { piece_id: pieceId, body: val, parent_id: replyingTo ?? undefined } })
      setBody("")
      setReplyingTo(null)
      const refreshed = await listComments({ data: { piece_id: pieceId } }) as any as CommentData[]
      setComments(withFirstPage(refreshed))
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : "Error posting comment")
    } finally {
      setPosting(false)
    }
  }

  // Sort root comments by upvotes, then by newest
  const rootComments = comments.filter(c => !c.parent_id).sort((a, b) => {
    const upA = a.upvotes ?? 0
    const upB = b.upvotes ?? 0
    if (upB !== upA) return upB - upA
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // Group children and sort them by oldest first (like Instagram replies)
  const childrenMap = new Map<string, CommentData[]>()
  for (const c of comments) {
    if (c.parent_id) {
      if (!childrenMap.has(c.parent_id)) childrenMap.set(c.parent_id, [])
      childrenMap.get(c.parent_id)!.push(c)
    }
  }
  for (const list of childrenMap.values()) {
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }

  function renderComment(c: CommentData, depth: number = 0) {
    const children = childrenMap.get(c.id) || []
    const isExpanded = expandedReplies[c.id] || focusParent === c.id
    
    return (
      <div key={c.id} id={`response-${c.id}`} className={`space-y-1 rounded-md transition-colors duration-1000 ${depth > 0 ? "ml-4 pl-4 border-l border-border" : ""} ${focused === c.id ? "bg-primary/10" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground">
              {c.author ? (
                <Link href={`/u/${c.author.handle}`} className="hover:underline">
                  {c.author.display_name}
                </Link>
              ) : (
                "Anonymous"
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(c.created_at)}
            </span>
          </div>
        </div>
        <div 
          className="text-sm text-foreground/90 whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none prose-p:my-1" 
          dangerouslySetInnerHTML={{ __html: sanitize(c.body) }}
        />
        
        {c.sources && c.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground/60 select-none">
            {c.sources.map((s, idx) => (
              <a
                key={idx}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                title={s.title}
                className="hover:text-foreground hover:underline transition-colors flex items-center gap-1"
              >
                <BookOpen className="size-3" />
                [{idx + 1}] {s.title}
              </a>
            ))}
          </div>
        )}

        <CommentActions
          comment={c}
          viewerId={viewerId}
          pieceAuthorId={pieceAuthorId}
          pieceId={pieceId}
          onDeleted={() => {
            setComments(comments.filter(x => x.id !== c.id))
          }}
          onRefresh={() => {
            listComments({ data: { piece_id: pieceId } }).then((data) => {
              setComments(withFirstPage(data as any as CommentData[]))
            })
          }}
          onReply={authed ? () => {
            setReplyingTo(replyingTo === c.id ? null : c.id)
            if (replyingTo !== c.id && c.author?.handle) {
              setTimeout(() => {
                editorRef.current?.insertMention(c.author!.handle, c.author!.handle)
              }, 50)
            }
          } : undefined}
        />
        

        
        {children.length > 0 && (
          <div className="mt-2 space-y-3">
            {!isExpanded ? (
              <button 
                onClick={() => setExpandedReplies(prev => ({ ...prev, [c.id]: true }))}
                className="text-xs font-semibold text-muted-foreground flex items-center gap-2 hover:text-foreground transition-colors ml-4"
              >
                <div className="w-6 h-px bg-border" />
                View replies ({children.length})
              </button>
            ) : (
              <>
                {children.map(child => renderComment(child, depth + 1))}
                <button 
                  onClick={() => setExpandedReplies(prev => ({ ...prev, [c.id]: false }))}
                  className="text-xs font-semibold text-muted-foreground flex items-center gap-2 mt-2 hover:text-foreground transition-colors ml-4"
                >
                  <div className="w-6 h-px bg-border" />
                  Hide replies
                </button>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col h-full border-l border-border bg-background">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="font-display">Responses</SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center">Loading...</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center">No responses yet. Be the first!</p>
          ) : (
            rootComments.map(c => renderComment(c, 0))
          )}
          {!loading && hasOlder && (
            <div className="text-center">
              <Button variant="outline" size="sm" onClick={loadOlder} disabled={loadingOlder}>
                {loadingOlder ? "Loading..." : "Load older responses"}
              </Button>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-border mt-auto">
          {authed ? (
            <div className="space-y-3 sheet-comment-editor">
              <CommentEditor
                ref={editorRef}
                placeholder={replyingTo ? "Write a reply..." : "What are your thoughts?"}
                value={body}
                onChange={(html) => setBody(html)}
                onSubmit={() => submit()}
                disabled={posting}
              />
              <div className="flex justify-end gap-2">
                {replyingTo && (
                  <Button variant="ghost" size="sm" onClick={() => { setReplyingTo(null); setBody("") }}>
                    Cancel
                  </Button>
                )}
                <Button size="sm" disabled={!body.trim() || posting} onClick={() => submit()}>
                  {posting ? "Posting..." : (replyingTo ? "Reply" : "Respond")}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              Sign in to leave a response.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
