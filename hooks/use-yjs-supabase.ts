import { useEffect, useState } from "react"
import * as Y from "yjs"
import * as awarenessProtocol from "y-protocols/awareness"
import { supabase } from "@/lib/supabase/client"
import { savePieceCrdt, loadPieceCrdt } from "@/actions/content/crdt"

// Browser-safe base64 <-> Uint8Array (chunked so a big doc doesn't blow the
// String.fromCharCode arg limit).
function u8ToB64(u8: Uint8Array): string {
  let s = ""
  const chunk = 0x8000
  for (let i = 0; i < u8.length; i += chunk) {
    s += String.fromCharCode(...u8.subarray(i, i + chunk))
  }
  return btoa(s)
}
function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64)
  const u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return u8
}

export function useYjsSupabase(pieceId: string, yDoc: Y.Doc | null) {
  const [awareness, setAwareness] = useState<awarenessProtocol.Awareness | null>(null)
  const [connected, setConnected] = useState(false)
  // Flips true once the durable snapshot has been loaded (or confirmed absent).
  // The composer waits for this before seeding DB blocks, so the snapshot and a
  // DB seed can't both populate the same Yjs array (which duplicated every block).
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!pieceId || !yDoc) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(false)

    const awarenessInst = new awarenessProtocol.Awareness(yDoc)
    setAwareness(awarenessInst)

    const channel = supabase.channel(`yjs-${pieceId}`, {
      config: {
        broadcast: { ack: false },
      },
    })

    // Debounced durable snapshot so the doc survives a fully-empty room.
    let saveTimer: ReturnType<typeof setTimeout> | null = null
    const persist = () => {
      try {
        const state = u8ToB64(Y.encodeStateAsUpdate(yDoc))
        void savePieceCrdt({ data: { pieceId, state } })
      } catch {
        /* best-effort */
      }
    }
    const scheduleSave = () => {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(persist, 5000)
    }

    const onUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin !== "supabase") {
        channel.send({
          type: "broadcast",
          event: "yjs-update",
          payload: {
            update: Array.from(update),
          },
        })
      }
      // Persist every real change (local or relayed) so durable state stays
      // current; the "persist" origin (initial load below) is skipped.
      if (origin !== "persist") scheduleSave()
    }

    const onAwarenessUpdate = (
      {
        added,
        updated,
        removed,
      }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown
    ) => {
      if (origin !== "supabase") {
        const changedClients = added.concat(updated, removed)
        const update = awarenessProtocol.encodeAwarenessUpdate(awarenessInst, changedClients)
        channel.send({
          type: "broadcast",
          event: "yjs-awareness",
          payload: {
            update: Array.from(update),
          },
        })
      }
    }

    yDoc.on("update", onUpdate)
    awarenessInst.on("update", onAwarenessUpdate)

    // Seed from the durable snapshot — restores the exact doc when reopening
    // after every peer had left (the relay keeps no state). Origin "persist" so
    // onUpdate re-broadcasts it to any peers but doesn't schedule a redundant save.
    loadPieceCrdt({ data: { pieceId } })
      .then(({ state }) => {
        if (state) {
          try {
            Y.applyUpdate(yDoc, b64ToU8(state), "persist")
            dedupeBlocks(yDoc) // heal snapshots corrupted by the old double-seed
          } catch (e) {
            console.error("Failed to apply persisted yjs state", e)
          }
        }
      })
      .catch(() => {})
      .finally(() => setHydrated(true))

    channel
      .on("broadcast", { event: "yjs-update" }, ({ payload }) => {
        try {
          const update = new Uint8Array(payload.update)
          Y.applyUpdate(yDoc, update, "supabase")
        } catch (e) {
          console.error("Failed to apply yjs update", e)
        }
      })
      .on("broadcast", { event: "yjs-awareness" }, ({ payload }) => {
        try {
          const update = new Uint8Array(payload.update)
          awarenessProtocol.applyAwarenessUpdate(awarenessInst, update, "supabase")
        } catch (e) {
          console.error("Failed to apply yjs awareness", e)
        }
      })
      .on("broadcast", { event: "yjs-sync-request" }, () => {
        // Someone joined and wants full state
        const stateVector = Y.encodeStateAsUpdate(yDoc)
        channel.send({
          type: "broadcast",
          event: "yjs-update",
          payload: {
            update: Array.from(stateVector),
          },
        })
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true)
          // Request initial sync
          channel.send({
            type: "broadcast",
            event: "yjs-sync-request",
            payload: {},
          })
        } else {
          setConnected(false)
        }
      })

    return () => {
      // Flush a final snapshot so edits in the last debounce window aren't lost.
      if (saveTimer) clearTimeout(saveTimer)
      persist()
      yDoc.off("update", onUpdate)
      awarenessInst.off("update", onAwarenessUpdate)
      awarenessInst.destroy()
      channel.unsubscribe()
    }
  }, [pieceId, yDoc])

  return { awareness, connected, hydrated }
}

// Remove duplicate-uid entries from the blocks array, keeping the first of each.
// Heals a snapshot that an earlier build corrupted by seeding DB blocks on top of
// the restored doc; the next persist then saves the cleaned state.
function dedupeBlocks(yDoc: Y.Doc) {
  const yBlocks = yDoc.getArray<Y.Map<unknown>>("blocks")
  const seen = new Set<string>()
  const dupIndices: number[] = []
  for (let i = 0; i < yBlocks.length; i++) {
    const uid = yBlocks.get(i).get("uid") as string | undefined
    if (uid && seen.has(uid)) dupIndices.push(i)
    else if (uid) seen.add(uid)
  }
  if (dupIndices.length === 0) return
  yDoc.transact(() => {
    for (const i of dupIndices.reverse()) yBlocks.delete(i, 1)
  })
}
