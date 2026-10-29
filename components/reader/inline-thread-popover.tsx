/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { X, Send, Pin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CommentEditor, type CommentEditorRef } from "../composer/comment-editor"
import { postComment } from "@/actions/comments"
import { sanitize } from "../block-renderer"
import { formatRelativeTime } from "@/lib/utils"

import { CommentActions, type CommentData } from "@/components/comment-actions"
import { toast } from "sonner"

interface Props {
  anchorRect: DOMRect | null
  pieceId: string
  pieceAuthorId?: string | null
  parentComment: CommentData | null
  replies: CommentData[]
  quotedText?: string
  onClose: () => void
  onCommentPosted: (newComment?: any) => void
  onCommentDeleted?: () => void
  viewerId?: string | null
}

export function InlineThreadPopover({
  anchorRect,
  pieceId,
  pieceAuthorId,
  parentComment,
  replies,
  quotedText,
  onClose,
  onCommentPosted,
  onCommentDeleted,
  viewerId,
}: Props) {
  const [body, setBody] = useState("")
  const [posting, setPosting] = useState(false)
  
  const editorRef = useRef<CommentEditorRef>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element).closest("#inline-thread-popover")) return
      if ((e.target as Element).closest(".inline-comment-marker")) return
      onClose()
    }
    setTimeout(() => { document.addEventListener("click", onClick) }, 10)
    return () => document.removeEventListener("click", onClick)
  }, [onClose])

  if (!anchorRect) return null

  const ESTIMATED_HEIGHT = 450
  let top = anchorRect.top + window.scrollY
  if (anchorRect.top + ESTIMATED_HEIGHT > window.innerHeight) {
    top -= (anchorRect.top + ESTIMATED_HEIGHT - window.innerHeight + 20)
  }
  
  const left = anchorRect.left + anchorRect.width + 10 + window.scrollX

  async function submit() {
    if (!body.trim()) return
    setPosting(true)
    try {
      const res = await postComment({
        data: {
          piece_id: pieceId,
          body: body.trim(),
          parent_id: parentComment?.id,
          quoted_text: parentComment ? undefined : quotedText,
        },
      })
      setBody("")
      onCommentPosted(res.data)
    } catch (e: any) {
      toast.error(e.message || "Failed to post comment")
    } finally {
      setPosting(false)
    }
  }

  return createPortal(
    <div
      id="inline-thread-popover"
      style={{ top, left: Math.min(left, window.innerWidth - 320) }}
      className="absolute z-50 flex w-[320px] flex-col rounded-lg border border-border bg-background shadow-xl animate-in zoom-in-95 duration-200 max-h-[calc(100vh-40px)] overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {parentComment?.is_pinned && <Pin className="size-3 text-primary" />}
          Thread
        </span>
        <button onClick={onClose} className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-1 min-h-0 max-h-80 flex-col gap-3 overflow-y-auto p-3">
        {quotedText && (
          <div className="border-l-2 border-primary/50 pl-2 text-sm italic text-muted-foreground">
            &ldquo;{quotedText}&rdquo;
          </div>
        )}

        {parentComment && (
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-xs text-foreground">
                {parentComment.author?.display_name || "Anonymous"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {formatRelativeTime(parentComment.created_at)}
              </span>
            </div>
            <div
              className="mt-1 text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1"
              dangerouslySetInnerHTML={{ __html: sanitize(parentComment.body) }}
            />
            <CommentActions
              comment={parentComment}
              viewerId={viewerId}
              pieceAuthorId={pieceAuthorId}
              pieceId={pieceId}
              onDeleted={() => onCommentDeleted?.()}
              onRefresh={onCommentPosted}
              onReply={viewerId ? () => {
                const handle = parentComment.author?.handle
                if (handle) {
                  setTimeout(() => editorRef.current?.insertMention(handle, handle), 50)
                }
              } : undefined}
            />
          </div>
        )}

        {replies.map((reply) => (
          <div key={reply.id} className="border-l-2 border-border pl-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-xs text-foreground">
                {reply.author?.display_name || "Anonymous"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {formatRelativeTime(reply.created_at)}
              </span>
            </div>
            <div
              className="mt-1 text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1"
              dangerouslySetInnerHTML={{ __html: sanitize(reply.body) }}
            />
            <CommentActions
              comment={reply}
              viewerId={viewerId}
              pieceAuthorId={pieceAuthorId}
              pieceId={pieceId}
              onDeleted={() => onCommentDeleted?.()}
              onRefresh={onCommentPosted}
              onReply={viewerId ? () => {
                const handle = reply.author?.handle
                if (handle) {
                  setTimeout(() => editorRef.current?.insertMention(handle, handle), 50)
                }
              } : undefined}
            />
          </div>
        ))}
      </div>

      <div className="border-t border-border bg-muted/10 p-2">
        <CommentEditor
          ref={editorRef}
          value={body}
          onChange={(html) => setBody(html)}
          onSubmit={submit}
          disabled={posting}
          placeholder="Reply to thread..."
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={submit} disabled={!body.trim() || posting}>
            {posting ? "Posting..." : <><Send className="mr-1 size-3" />Reply</>}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

