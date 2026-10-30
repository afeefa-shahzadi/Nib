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
    if (isCommentAuthor) return
    const prev = userVote
    const before = { up: upvotes, down: downvotes }
    const next = userVote === type ? 0 : type
    // optimistic
    setUserVote(next)
    if (next === 0) { if (type === 1) { setUpvotes(v => v - 1) } else { setDownvotes(v => v - 1) } }
    else if (type === 1) { setUpvotes(v => v + 1); if (prev === -1) setDownvotes(v => v - 1) }
    else { setDownvotes(v => v + 1); if (prev === 1) setUpvotes(v => v - 1) }
    try {
      await toggleCommentVote(comment.id, next as 0 | 1 | -1)
    } catch (e: Error | unknown) {
      toast.error((e as Error).message || "Couldn't save your vote.")
      setUserVote(prev)
      setUpvotes(before.up)
      setDownvotes(before.down)
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
        disabled={isCommentAuthor}
        aria-label={`Helpful${upvotes ? `, ${upvotes}` : ""}`}
        aria-pressed={userVote === 1}
        title={isCommentAuthor ? "You can't vote on your own response" : "Helpful"}
        className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded px-1.5 text-xs transition-colors lg:min-h-7 lg:min-w-7 disabled:cursor-default disabled:opacity-60 ${
          userVote === 1 ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <ThumbsUp className="size-3.5" aria-hidden />
        {upvotes > 0 && <span>{upvotes}</span>}
      </button>
      <button
        onClick={() => handleVote(-1)}
        disabled={isCommentAuthor}
        aria-label={`Not helpful${downvotes ? `, ${downvotes}` : ""}`}
        aria-pressed={userVote === -1}
        title={isCommentAuthor ? "You can't vote on your own response" : "Not helpful"}
        className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded px-1.5 text-xs transition-colors lg:min-h-7 lg:min-w-7 disabled:cursor-default disabled:opacity-60 ${
          userVote === -1 ? "text-destructive" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <ThumbsDown className="size-3.5" aria-hidden />
        {downvotes > 0 && <span>{downvotes}</span>}
      </button>

      {onReply && (
        <button
          onClick={onReply}
          aria-label="Reply"
          title="Reply"
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded px-1.5 text-xs transition-colors lg:min-h-7 lg:min-w-7 ml-1 text-muted-foreground hover:text-foreground"
        >
          <Reply className="size-3.5" aria-hidden />
        </button>
      )}

      <span className="flex-1" />

      {pieceId && !isCommentAuthor && (
        <ReportButton
          pieceId={pieceId}
          authed={!!viewerId}
          targetType="comment"
          targetId={comment.id}
          className="min-h-11 px-1.5 text-xs lg:min-h-7"
        />
      )}
      {canPin && (
        <button
          onClick={handlePin}
          title={isPinned ? "Unpin" : "Pin to top"}
          aria-label={isPinned ? "Unpin" : "Pin to top"}
          className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded px-1.5 text-xs transition-colors lg:min-h-7 lg:min-w-7 ${
            isPinned ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {isPinned ? <PinOff className="size-3.5" aria-hidden /> : <Pin className="size-3.5" aria-hidden />}
        </button>
      )}
      {canDelete && (
        <button
          onClick={handleDelete}
          title="Delete"
          aria-label="Delete response"
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded px-1.5 text-xs transition-colors lg:min-h-7 lg:min-w-7 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  )
}
