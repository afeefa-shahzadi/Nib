"use client"
import { useState } from "react"
import { ThumbsUp, ThumbsDown, Trash2, Pin, PinOff, Reply } from "lucide-react"
import { toggleCommentVote, togglePinComment, deleteComment } from "@/actions/comments"
import { toast } from "sonner"
import { ReportButton } from "./report-button"

export type CommentData = {
  id: string
  body: string
  created_at: string
  parent_id?: string | null
  user_id?: string
  is_pinned?: boolean
  upvotes?: number
  downvotes?: number
  user_vote?: number
  author?: { handle: string; display_name: string; avatar_url?: string } | null
  sources?: { title: string; url: string }[] | null
}

export function CommentActions({
  comment,
  viewerId,
  pieceAuthorId,
  pieceId,
  onDeleted,
  onRefresh,
  onReply,
}: {
  comment: CommentData
  viewerId: string | null | undefined
  pieceAuthorId: string | null | undefined
  pieceId?: string
  onDeleted: () => void
  onRefresh: () => void
  onReply?: () => void
}) {
  const [upvotes, setUpvotes] = useState(comment.upvotes ?? 0)
  const [downvotes, setDownvotes] = useState(comment.downvotes ?? 0)
  const [userVote, setUserVote] = useState(comment.user_vote ?? 0)
  const [isPinned, setIsPinned] = useState(comment.is_pinned ?? false)

  const isCommentAuthor = !!(viewerId && comment.user_id === viewerId)
  const isPieceAuthor = !!(viewerId && pieceAuthorId && viewerId === pieceAuthorId)
  const canDelete = isCommentAuthor || isPieceAuthor
  const canPin = isPieceAuthor

  async function handleVote(type: 1 | -1) {
    if (!viewerId) { toast.error("Sign in to vote"); return }
    const prev = userVote
    const next = userVote === type ? 0 : type
    // optimistic
    setUserVote(next)
    if (next === 0) { if (type === 1) { setUpvotes(v => v - 1) } else { setDownvotes(v => v - 1) } }
    else if (type === 1) { setUpvotes(v => v + 1); if (prev === -1) setDownvotes(v => v - 1) }
    else { setDownvotes(v => v + 1); if (prev === 1) setUpvotes(v => v - 1) }
    try {
      await toggleCommentVote(comment.id, next as 0 | 1 | -1)
    } catch (e: Error | unknown) {
      toast.error((e as Error).message || "Failed to vote")
      setUserVote(prev)
    }
  }

  async function handleDelete() {
    try {
      await deleteComment(comment.id)
      onDeleted()
    } catch (e: Error | unknown) {
      toast.error((e as Error).message || "Failed to delete")
    }
  }

  async function handlePin() {
    const next = !isPinned
    setIsPinned(next)
    try {
      await togglePinComment(comment.id, next)
      onRefresh()
    } catch (e: Error | unknown) {
      toast.error((e as Error).message || "Failed to pin")
      setIsPinned(!next)
    }
  }

  return (
    <div className="mt-1.5 flex items-center gap-1">
      <button
        onClick={() => handleVote(1)}
        className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] transition-colors ${
          userVote === 1 ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <ThumbsUp className="size-3" />
        {upvotes > 0 && <span>{upvotes}</span>}
      </button>
      <button
        onClick={() => handleVote(-1)}
        className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] transition-colors ${
          userVote === -1 ? "text-destructive" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <ThumbsDown className="size-3" />
        {downvotes > 0 && <span>{downvotes}</span>}
      </button>

      {onReply && (
        <button
          onClick={onReply}
          className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground ml-2"
        >
          <Reply className="size-3" />
        </button>
      )}

      <span className="flex-1" />

      {pieceId && !isCommentAuthor && (
        <ReportButton
          pieceId={pieceId}
          authed={!!viewerId}
          targetType="comment"
          targetId={comment.id}
          className="text-[11px] px-1 py-0.5"
        />
      )}
      {canPin && (
        <button
          onClick={handlePin}
          title={isPinned ? "Unpin" : "Pin to top"}
          className={`rounded p-0.5 transition-colors ${
            isPinned ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {isPinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
        </button>
      )}
      {canDelete && (
        <button
          onClick={handleDelete}
          title="Delete"
          className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="size-3" />
        </button>
      )}
    </div>
  )
}
