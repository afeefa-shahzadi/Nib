 
"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import Image from "next/image"
import { getProfileCard } from "@/actions/social"
import { FollowButton } from "@/components/follow-button"
import { ProfileCard } from "@/lib/types/content"
import { formatCompactNumber } from "@/lib/utils"

/**
 * Listens for hover on any `a[href^="/u/"]` inside `containerRef`
 * and shows a floating profile card. Pure delegation — no per-link wrapping.
 */
export function MentionHoverPortal({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLElement | null>
}) {
  const [card, setCard] = useState<ProfileCard | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [pinned, setPinned] = useState(false)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const cache = useRef(new Map<string, ProfileCard>())
  const hideTimer = useRef<NodeJS.Timeout | null>(null)
  const fetchProfile = getProfileCard

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const cancelHide = () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current)
        hideTimer.current = null
      }
    }
    const scheduleHide = () => {
      cancelHide()
      hideTimer.current = setTimeout(() => {
        setCard(null)
        setPos(null)
      }, 220)
    }

    const onEnter = async (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest(
        'a[href^="/u/"]'
      ) as HTMLAnchorElement | null
      if (!a) return
      const href = a.getAttribute("href") || ""
      const m = href.match(/^\/u\/([^/]+?)(?:\/|$)/)
      if (!m) return
      const handle = decodeURIComponent(m[1])
      // Skip if this is a link to a specific piece (we hover the author chip only on bare /u/handle)
      if (/^\/u\/[^/]+\/.+/.test(href)) return
      cancelHide()
      const rect = a.getBoundingClientRect()
      setPos({ top: rect.bottom + 8, left: rect.left })
      const cached = cache.current.get(handle)
      if (cached) {
        setCard(cached)
        return
      }
      try {
        const data = await fetchProfile({ data: { handle } })
        if (!data) return
        cache.current.set(handle, data)
        setCard(data)
      } catch {
        /* swallow */
      }
    }

    const onLeave = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest('a[href^="/u/"]')
      if (!a) return
      if (pinned) return
      scheduleHide()
    }

    el.addEventListener("mouseover", onEnter)
    el.addEventListener("mouseout", onLeave)
    return () => {
      el.removeEventListener("mouseover", onEnter)
      el.removeEventListener("mouseout", onLeave)
      cancelHide()
    }
  }, [containerRef, fetchProfile, pinned])

  if (!card || !pos || typeof window === "undefined") return null

  // Clamp horizontally
  const left = Math.min(pos.left, window.innerWidth - 320)
  return createPortal(
    <div
      ref={cardRef}
      style={{ top: pos.top, left }}
      onMouseEnter={() => setPinned(true)}
      onMouseLeave={() => {
        setPinned(false)
        setCard(null)
        setPos(null)
      }}
      className="animate-fade-in fixed z-50 w-75 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-xl"
    >
      <div className="flex items-center gap-3">
        <div className="size-10 shrink-0 overflow-hidden rounded-full bg-muted">
          {card.avatar_url ? (
            <Image
              src={card.avatar_url}
              alt=""
              width={40}
              height={40}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center font-display text-sm text-muted-foreground">
              {card.display_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/u/${card.handle}`}
            className="block truncate font-display text-base text-foreground hover:text-primary"
          >
            {card.display_name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            @{card.handle}
          </p>
        </div>
      </div>
      {card.bio && (
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-foreground/85">
          {card.bio}
        </p>
      )}
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground tabular-nums">
            {formatCompactNumber(card.followers)}
          </span>{" "}
          followers
        </span>
        <span>
          <span className="font-semibold text-foreground tabular-nums">
            {formatCompactNumber(card.pieces)}
          </span>{" "}
          pieces
        </span>
      </div>
      <div className="mt-3">
        <FollowButton
          authorId={card.id}
          authorHandle={card.handle}

        />
      </div>
    </div>,
    document.body
  )
}
