/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Trash2 } from "lucide-react"

interface Props {
  viewerId: string | null
  highlights: any[]
  onDelete: (highlightId: string) => void
}

export function HighlightHoverTrash({ viewerId, highlights, onDelete }: Props) {
  const [state, setState] = useState<{
    x: number
    y: number
    highlightId: string
    note: string | null
    isOwner: boolean
  } | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }

  const scheduleHide = useCallback(() => {
    clearHide()
    hideTimer.current = setTimeout(() => setState(null), 150)
  }, [])

  useEffect(() => {
    // Hover (mouse), tap (touch) and focus (keyboard) all open the note.
    const onOver = (e: Event) => {
      const target = e.target as HTMLElement
      const marker = target.closest(".highlight-marker") as HTMLElement | null
      if (!marker) return

      const highlightId = marker.getAttribute("data-highlight-id")
      if (!highlightId) return

      const highlight = highlights.find((h: any) => h.id === highlightId)
      if (!highlight) return

      clearHide()
      const rect = marker.getBoundingClientRect()
      const note = highlight.annotations?.[0]?.note ?? null
      const isOwner = !!(viewerId && highlight.user_id === viewerId)

      // Only show tooltip if there's a note or the user is the owner
      if (!note && !isOwner) return

      setState({
        x: rect.left + rect.width / 2 + window.scrollX,
        y: rect.top + window.scrollY,
        highlightId,
        note,
        isOwner,
      })
    }

    const onOut = (e: MouseEvent) => {
      const target = e.relatedTarget as HTMLElement | null
      if (target?.closest(".highlight-marker") || target?.closest("#highlight-tooltip")) return
      scheduleHide()
    }

    const onDown = (e: Event) => {
      const t = e.target as HTMLElement
      if (!t.closest(".highlight-marker") && !t.closest("#highlight-tooltip")) setState(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setState(null)

    document.addEventListener("mouseover", onOver)
    document.addEventListener("mouseout", onOut)
    document.addEventListener("click", onOver)
    document.addEventListener("focusin", onOver)
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mouseover", onOver)
      document.removeEventListener("mouseout", onOut)
      document.removeEventListener("click", onOver)
      document.removeEventListener("focusin", onOver)
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
      clearHide()
    }
  }, [highlights, viewerId, scheduleHide])

  if (!state) return null

  return createPortal(
    <div
      id="highlight-tooltip"
      role="tooltip"
      onMouseEnter={clearHide}
      onMouseLeave={scheduleHide}
      style={{
        position: "absolute",
        top: state.y - 8,
        left: state.x,
        zIndex: 9999,
        transform: "translate(-50%, -100%)",
      }}
      className="flex items-center gap-2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg"
    >
      {state.note && <span className="max-w-[220px] whitespace-normal">{state.note}</span>}
      {state.note && state.isOwner && <span className="text-border">|</span>}
      {state.isOwner && (
        <button
          onClick={() => {
            onDelete(state.highlightId)
            setState(null)
          }}
          className="inline-flex size-11 shrink-0 items-center justify-center text-destructive transition-colors hover:text-destructive/70 lg:size-7"
          title="Delete highlight"
          aria-label="Delete highlight"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </div>,
    document.body
  )
}
