"use client"

import { useCallback, useEffect, useRef } from "react"
import { recordTelemetry } from "@/actions/telemetry"
import { supabase } from "@/lib/supabase/client"

/** Stable session id for grouping a reader's events on this device. */
function getSessionId(): string {
  if (typeof window === "undefined") return "ssr"
  const KEY = "mycelium:tsid"
  let v = window.localStorage.getItem(KEY)
  if (!v) {
    v = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    try {
      window.localStorage.setItem(KEY, v)
    } catch {
      /* private mode */
    }
  }
  return v
}

interface UseReaderTelemetryOpts {
  pieceId: string
  mode: string
  articleRef: React.RefObject<HTMLElement | null>
}

/**
 * Records reader telemetry for a published piece:
 *  - one `view` per session-per-piece-per-mount
 *  - `mode_switch` whenever `mode` changes
 *  - `read_depth` at 25/50/75/100% scroll milestones, each fired once.
 */
export function useReaderTelemetry({
  pieceId,
  mode,
  articleRef,
}: UseReaderTelemetryOpts) {
  const recordFn = recordTelemetry
  const sessionRef = useRef<string>(
    typeof window === "undefined" ? "ssr" : getSessionId()
  )
  const viewerIdRef = useRef<string | null>(null)
  const sentDepthRef = useRef<Set<number>>(new Set())
  const lastModeRef = useRef<string | null>(null)
  const sentViewRef = useRef(false)

  // resolve viewer id once
  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) viewerIdRef.current = data.session?.user?.id ?? null
    })
    return () => {
      active = false
    }
  }, [])

  type TMode = "skim" | "standard" | "expert" | "teach" | "debate"
  const asMode = useCallback((m: string | null | undefined): TMode | null => {
    return m === "skim" ||
      m === "standard" ||
      m === "expert" ||
      m === "teach" ||
      m === "debate"
      ? m
      : null
  }, [])

  const fire = useCallback(
    (
      event: "view" | "mode_switch" | "read_depth" | "share" | "full_read",
      extra: { mode?: string | null; depth?: number | null; timeSpentSeconds?: number } = {}
    ) => {
      try {
        void recordFn({
          data: {
            piece_id: pieceId,
            event,
            mode: asMode(extra.mode),
            depth: extra.depth ?? null,
            session: sessionRef.current,
            viewer_id: viewerIdRef.current,
            payload: extra.timeSpentSeconds !== undefined ? { timeSpentSeconds: extra.timeSpentSeconds } : null,
          },
        }).catch(() => {
          /* swallow */
        })
      } catch {
        /* never throw from telemetry */
      }
    },
    [recordFn, pieceId, asMode]
  )

  // view (once per mount)
  useEffect(() => {
    if (sentViewRef.current) return
    sentViewRef.current = true
    fire("view", { mode })
  }, [pieceId, fire, mode])

  // mode switch
  useEffect(() => {
    if (lastModeRef.current === null) {
      lastModeRef.current = mode
      return
    }
    if (lastModeRef.current !== mode) {
      lastModeRef.current = mode
      fire("mode_switch", { mode })
    }
  }, [mode, fire])

  const mountTimeRef = useRef<number>(0)

  // read depth — reset milestones per mode (different content layout)
  useEffect(() => {
    sentDepthRef.current = new Set()
    mountTimeRef.current = Date.now() // reset time on mode switch
  }, [mode, pieceId])

  useEffect(() => {
    let activeTimeMs = 0
    let lastTick = Date.now()
    
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        activeTimeMs += (Date.now() - lastTick)
      }
      lastTick = Date.now()
    }, 1000)

    const onScroll = () => {
      const el = articleRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const total = el.scrollHeight - window.innerHeight
      const scrolled = Math.max(0, -rect.top)
      const pct =
        total > 0 ? Math.min(100, Math.round((scrolled / total) * 100)) : 0
      
      const timeSpentSeconds = Math.round(activeTimeMs / 1000)

      for (const milestone of [25, 50, 75, 100]) {
        if (pct >= milestone && !sentDepthRef.current.has(milestone)) {
          sentDepthRef.current.add(milestone)
          fire("read_depth", { depth: milestone, mode, timeSpentSeconds } as Record<string, unknown>)
          
          if (milestone === 100) {
            // Estimate based on text content if passed, or default approx reading speed of 200WPM.
            // 200 WPM = ~3 words per sec. We'll use a conservative 2 words/sec.
            const wordCount = el.innerText.split(/\s+/).length
            const estimatedTimeSeconds = Math.max(10, Math.round(wordCount / 3.3)) // 200 WPM
            
            if (timeSpentSeconds >= estimatedTimeSeconds * 0.8) {
              fire("full_read", { mode, timeSpentSeconds })
            }
          }
        }
      }
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      clearInterval(interval)
    }
  }, [articleRef, pieceId, fire, mode])

  return {
    recordShare: () => fire("share", { mode }),
  }
}
