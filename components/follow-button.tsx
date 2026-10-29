"use client"

import { useEffect, useState } from "react"
import { UserPlus, UserCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import { LoginRequiredDialog } from "@/components/login-required-dialog"
import {
  followAuthor,
  unfollowAuthor,
  isFollowing,
  getFollowStatus,
} from "@/actions/social"

interface Props {
  authorId: string
  authorHandle: string
  size?: "sm" | "default"
  className?: string
  onFollowChange?: (following: boolean, count: number) => void
}

export function FollowButton({
  authorId,
  authorHandle,
  size = "sm",
  className = "w-fit",
  onFollowChange,
}: Props) {
  const followFn = followAuthor
  const unfollowFn = unfollowAuthor
  const checkFn = isFollowing
  const countFn = getFollowStatus
  const [loginOpen, setLoginOpen] = useState(false)

  const [me, setMe] = useState<string | null>(null)
  const [followingState, setFollowingState] = useState<boolean | null>(null)
  const following = !me || me === authorId ? false : followingState
  const [followers, setFollowers] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) =>
      setMe(s?.user?.id ?? null)
    )
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setMe(session?.user?.id ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    countFn({ data: { author_id: authorId } })
      .then((r) => setFollowers(r.followers))
      .catch(() => {})
  }, [authorId, countFn])

  useEffect(() => {
    if (!me || me === authorId) return
    checkFn({ data: { author_id: authorId } })
      .then((r) => setFollowingState(r.following))
      .catch(() => {})
  }, [me, authorId, checkFn])

  // A page can render several FollowButtons for the same author (aside,
  // inline card, mobile bar); each holds local state, so a click in one
  // left the others stale. Broadcast changes so all instances stay in sync.
  useEffect(() => {
    const onSync = (e: Event) => {
      const d = (e as CustomEvent<{ authorId: string; following: boolean; count: number }>).detail
      if (d.authorId !== authorId) return
      setFollowingState(d.following)
      setFollowers(d.count)
    }
    window.addEventListener("mycelium:follow-change", onSync)
    return () => window.removeEventListener("mycelium:follow-change", onSync)
  }, [authorId])

  if (me === authorId) {
    return null
  }

  const toggle = async () => {
    if (!me) {
      setLoginOpen(true)
      return
    }
    setBusy(true)
    try {
      if (following) {
        await unfollowFn({ data: { author_id: authorId } })
        setFollowingState(false)
        const newCount = Math.max(0, (followers ?? 1) - 1)
        setFollowers(newCount)
        onFollowChange?.(false, newCount)
        window.dispatchEvent(new CustomEvent("mycelium:follow-change", { detail: { authorId, following: false, count: newCount } }))
      } else {
        await followFn({ data: { author_id: authorId } })
        setFollowingState(true)
        const newCount = (followers ?? 0) + 1
        setFollowers(newCount)
        onFollowChange?.(true, newCount)
        window.dispatchEvent(new CustomEvent("mycelium:follow-change", { detail: { authorId, following: true, count: newCount } }))
        toast.success(
          `Following @${authorHandle}. You'll be notified of new pieces.`
        )
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="contents">
        <Button
          size={size}
          variant={following ? "outline" : "default"}
          onClick={toggle}
          disabled={busy || (!!me && following === null)}
          aria-pressed={!!following}
          aria-label={
            following ? `Unfollow @${authorHandle}` : `Follow @${authorHandle}`
          }
          className={className}
        >
          {busy ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : following ? (
            <UserCheck className="mr-1.5 size-3.5" />
          ) : (
            <UserPlus className="mr-1.5 size-3.5" />
          )}
          {following ? "Following" : "Follow"}
        </Button>
      </div>
      <LoginRequiredDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        title={`Sign in to follow @${authorHandle}`}
        description="Create a free account or sign in — we'll bring you back to this profile."
        redirectTo={`/u/${authorHandle}`}
      />
    </>
  )
}
