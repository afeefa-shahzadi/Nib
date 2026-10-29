/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

export interface CoAuthorPresence {
  id: string
  handle: string
  avatar_url?: string
  activeBlockId: string | null
  lastSeen: number
}

export function usePiecePresence(
  pieceId: string,
  currentUser: { id: string; handle: string; avatar_url?: string }
) {
  const [presences, setPresences] = useState<Record<string, CoAuthorPresence>>(
    {}
  )
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!pieceId || !currentUser.id) return

    const ch = supabase.channel(`piece-presence:${pieceId}`, {
      config: {
        presence: { key: currentUser.id },
      },
    })

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState()
      const newPresences: Record<string, CoAuthorPresence> = {}
      for (const [key, presArr] of Object.entries(state)) {
        if (key === currentUser.id) continue // Skip self
        if (presArr.length > 0) {
          const p = presArr[0] as any as {
            handle: string
            avatar_url?: string
            activeBlockId: string | null
          }
          newPresences[key] = {
            id: key,
            handle: p.handle,
            avatar_url: p.avatar_url,
            activeBlockId: p.activeBlockId,
            lastSeen: Date.now(),
          }
        }
      }
      setPresences(newPresences)
    })
      .on("presence", { event: "join" }, () => {
        // Handled by sync
      })
      .on("presence", { event: "leave" }, () => {
        // Handled by sync
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({
            handle: currentUser.handle,
            avatar_url: currentUser.avatar_url,
            activeBlockId: null,
          })
        }
      })

    channelRef.current = ch

    return () => {
      ch.unsubscribe()
    }
  }, [pieceId, currentUser.id, currentUser.handle, currentUser.avatar_url])

  const updateActiveBlock = async (blockId: string | null) => {
    if (channelRef.current && channelRef.current.state === "joined") {
      await channelRef.current.track({
        handle: currentUser.handle,
        avatar_url: currentUser.avatar_url,
        activeBlockId: blockId,
      })
    }
  }

  return { presences, updateActiveBlock }
}
