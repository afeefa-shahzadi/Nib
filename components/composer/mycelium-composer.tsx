"use client"
import { textToParagraphHtml } from "@/lib/html"
import { useCallback, useEffect, useRef, useState, useMemo, useSyncExternalStore } from "react"
import { ChevronLeft, PanelLeft, PanelRight } from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import * as Y from "yjs"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { OutlinePane } from "./outline-pane"
import { SlashMenu } from "./slash-menu"
import { ComposerHeader } from "./composer-header"
import { CanvasArea } from "./canvas-area"
import { InspectorAside } from "./inspector-aside"
import { EmbeddedRepost } from "@/components/reader/embedded-repost"
import { MetaDialog } from "./meta-dialog"
import { ScheduleDialog } from "./schedule-dialog"
import { MinimapDialog } from "./minimap-dialog"
import { VoiceDictation } from "./voice-dictation"
import { createSaveQueue } from "./save-queue"
import { lastTextEditor } from "./rich-block-editor"
import {
  makeBlock,
  decodeBlock,
  encodeBlock,
  type BlockDraft,
  type ReadingMode,
  type BlockKind,
} from "./types"
import {
  getMyPiece,
  updatePiece,
  saveBlocks,
  deletePiece,
  createPieceVersion,
} from "@/actions/content"
import { generateModeVariant, suggestPieceMeta } from "@/actions/ai"
import { getMyProfile } from "@/actions/content"
import { usePiecePresence } from "@/hooks/use-piece-presence"
import { useYjsSupabase } from "@/hooks/use-yjs-supabase"
import { useComposerTour } from "@/hooks/use-composer-tour"

interface Props {
  pieceId: string
}

const AUTOSAVE_MS = 3000

/** Transaction origin for block add/remove/move — what undo/redo operates on. */
const STRUCTURAL_ORIGIN = "structural"

// Fix #13: piece metadata as a single object instead of 9 flat useState calls
interface PieceMeta {
  title: string
  summary: string
  thesis: string
  tags: string
  tipsEnabled: boolean
  sponsorshipEnabled: boolean
  repostCreditsRequired: boolean
  isNsfw: boolean
  allowInlineComments: boolean
  coverImageUrl: string | null
}

const DEFAULT_META: PieceMeta = {
  title: "",
  summary: "",
  thesis: "",
  tags: "",
  tipsEnabled: true,
  sponsorshipEnabled: false,
  repostCreditsRequired: true,
  isNsfw: false,
  allowInlineComments: true,
  coverImageUrl: null,
}

const WIDE = "(min-width: 1024px)"
const subscribeWide = (cb: () => void) => {
  const mql = window.matchMedia(WIDE)
  mql.addEventListener("change", cb)
  return () => mql.removeEventListener("change", cb)
}

export function MyceliumComposer({ pieceId }: Props) {
  const router = useRouter()

  // Fix #6: track mount state so async callbacks never setState after unmount
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const q = useQuery({
    queryKey: ["my-piece", pieceId],
    queryFn: () => getMyPiece({ data: { id: pieceId } }),
  })

  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getMyProfile(),
  })
  const currentUser = profileQuery.data
    ? {
        id: profileQuery.data.id,
        handle: profileQuery.data.handle,
        avatar_url: profileQuery.data.avatar_url || undefined,
      }
    : { id: "", handle: "" }

  const status = q.data?.piece.status ?? "draft"
  const slug = q.data?.piece.slug ?? ""

  // Fix #13: single meta object replaces 9 independent useState calls
  const [meta, setMeta] = useState<PieceMeta>(DEFAULT_META)
  const title = meta.title
  const summary = meta.summary
  const thesis = meta.thesis
  const tags = meta.tags
  const tipsEnabled = meta.tipsEnabled
  const sponsorshipEnabled = meta.sponsorshipEnabled
  const repostCreditsRequired = meta.repostCreditsRequired
  const isNsfw = meta.isNsfw
  const allowInlineComments = meta.allowInlineComments
  const coverImageUrl = meta.coverImageUrl

  const setTitle = (v: string) => setMeta((m) => ({ ...m, title: v }))
  const setSummary = (v: string) => setMeta((m) => ({ ...m, summary: v }))
  const setThesis = (v: string) => setMeta((m) => ({ ...m, thesis: v }))
  const setTags = (v: string) => setMeta((m) => ({ ...m, tags: v }))
  const setTipsEnabled = (v: boolean) => setMeta((m) => ({ ...m, tipsEnabled: v }))
  const setSponsorshipEnabled = (v: boolean) => setMeta((m) => ({ ...m, sponsorshipEnabled: v }))
  const setRepostCreditsRequired = (v: boolean) => setMeta((m) => ({ ...m, repostCreditsRequired: v }))
  const setIsNsfw = (v: boolean) => setMeta((m) => ({ ...m, isNsfw: v }))
  const setAllowInlineComments = (v: boolean) => setMeta((m) => ({ ...m, allowInlineComments: v }))

  const [blocks, setBlocks] = useState<BlockDraft[]>([])
  const [activeUid, setActiveUid] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<ReadingMode | null>(null)
  const [aiMetaBusy, setAiMetaBusy] = useState(false)
  const [aiBlockBusy, setAiBlockBusy] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [savedAgo, setSavedAgo] = useState("—")
  const [saving, setSaving] = useState(false)
  const [showMeta, setShowMeta] = useState(false)
  const [showMinimap, setShowMinimap] = useState(false)
  // Guided Tour — only auto-starts once the piece actually loads, so it never
  // fires over the "Piece not found"/error state.
  const { startTour } = useComposerTour(!!q.data?.piece)
  const [diffingUid, setDiffingUid] = useState<string | null>(null)
  const [diffingMode, setDiffingMode] = useState<ReadingMode | null>(null)
  const [showSchedule, setShowSchedule] = useState(false)
  const [readerPreview, setReaderPreview] = useState(false)
  const [heatmapEnabled, setHeatmapEnabled] = useState(false)
  const [outlineCollapsed, setOutlineCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem("composer:outline-collapsed") === "1"
  })
  const [inspectorCollapsed, setInspectorCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem("composer:inspector-collapsed") === "1"
  })
  const [outlineSheet, setOutlineSheet] = useState(false)
  const [inspectorSheet, setInspectorSheet] = useState(false)
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => true)
  const [inspectorTab, setInspectorTab] = useState<"inspector" | "archive" | "synthesis">(
    "inspector"
  )

  const { presences, updateActiveBlock } = usePiecePresence(
    pieceId,
    currentUser
  )

  const activeUidRef = useRef<string | null>(null)
  useEffect(() => { activeUidRef.current = activeUid }, [activeUid])

  const [yDoc] = useState(() => new Y.Doc())
  const { awareness, hydrated } = useYjsSupabase(pieceId, yDoc)
  const yBlocks = useMemo(() => yDoc.getArray<Y.Map<unknown>>("blocks"), [yDoc])
  // The toolbar buttons promise "undo structural change". Every keystroke and
  // every automatic content rewrite (citation renumbering, AI variants) also
  // mutates maps inside this array, so an untracked UndoManager filled its
  // stack with those and each click popped an invisible content edit instead
  // of the block you just added. Tag structural transactions and track only
  // those; prose already has the editor's own undo.
  const yUndoManager = useMemo(
    () =>
      new Y.UndoManager(yBlocks, {
        trackedOrigins: new Set([STRUCTURAL_ORIGIN]),
      }),
    [yBlocks]
  )

  // Toolbar Undo/Redo: text history of the last-focused block first (phones
  // have no Ctrl+Z), else structural. A new structural change hands the
  // buttons back to structural undo.
  useEffect(() => {
    const reset = () => { lastTextEditor.current = null }
    yUndoManager.on("stack-item-added", reset)
    return () => yUndoManager.off("stack-item-added", reset)
  }, [yUndoManager])
  const onUndo = useCallback(() => {
    const ed = lastTextEditor.current
    if (ed && !ed.isDestroyed && ed.can().undo()) ed.commands.undo()
    else yUndoManager.undo()
  }, [yUndoManager])
  const onRedo = useCallback(() => {
    const ed = lastTextEditor.current
    if (ed && !ed.isDestroyed && ed.can().redo()) ed.commands.redo()
    else yUndoManager.redo()
  }, [yUndoManager])

  // dirty tracking
  const lastSerialized = useRef<string>("")
  const blocksDirty = useRef(false)
  const dirtyBlocksRef = useRef<Set<string>>(new Set())
  const metaDirty = useRef(false)

  useEffect(() => {
    const syncBlocks = (events?: Y.YEvent<Y.AbstractType<unknown>>[], txn?: Y.Transaction) => {
      setBlocks(yBlocks.toArray().map(m => m.toJSON() as BlockDraft))
      // Any local change must reach autosave. Undo/redo (origin: the
      // UndoManager) rewrote yBlocks without going through the mutation
      // helpers that set the dirty flags, so the undone state was never sent
      // and the blocks table kept the pre-undo rows. Remote updates are not
      // local — their author saves them.
      if (!txn?.local || !events) return
      blocksDirty.current = true
      for (const ev of events) {
        if (ev.target instanceof Y.Map) {
          const uid = ev.target.get("uid")
          if (typeof uid === "string") dirtyBlocksRef.current.add(uid)
        } else {
          ev.changes.added.forEach((item) =>
            item.content.getContent().forEach((m) => {
              if (m instanceof Y.Map && typeof m.get("uid") === "string")
                dirtyBlocksRef.current.add(m.get("uid"))
            })
          )
        }
      }
    }
    yBlocks.observeDeep(syncBlocks)
    syncBlocks()
    return () => yBlocks.unobserveDeep(syncBlocks)
  }, [yBlocks])


  useEffect(() => {
    window.localStorage.setItem(
      "composer:outline-collapsed",
      outlineCollapsed ? "1" : "0"
    )
  }, [outlineCollapsed])

  const [isOnline, setIsOnline] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => {
      if (!navigator.onLine) setIsOnline(false)
    }, 0)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      clearTimeout(t)
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(
      "composer:inspector-collapsed",
      inspectorCollapsed ? "1" : "0"
    )
  }, [inspectorCollapsed])

  // slash menu
  const [slash, setSlash] = useState<{
    uid: string
    anchor: { x: number; y: number }
    query: string
  } | null>(null)


  // Load from server — only once per pieceId, so a refetch after autosave
  // doesn't overwrite locally edited blocks (which caused phantom duplicates).
  const loadedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!q.data?.piece) return
    // Wait for the durable snapshot to load first. Seeding DB blocks before it
    // arrives let both populate yBlocks with the same uids → duplicate React
    // keys. Once hydrated, yBlocks is non-empty if the snapshot had content, so
    // the length guard below skips the DB seed; it seeds only a truly new doc.
    if (!hydrated) return
    if (loadedFor.current === pieceId) return
    loadedFor.current = pieceId

    const piece = q.data.piece
    const dataBlocks = q.data.blocks

    setMeta({
      title: piece.title,
      summary: piece.summary ?? "",
      thesis: piece.canonical_thesis ?? "",
      tags: (piece.tags ?? []).join(", "),
      tipsEnabled: piece.tips_enabled ?? true,
      sponsorshipEnabled: piece.sponsorship_enabled ?? false,
      repostCreditsRequired: piece.repost_credits_required ?? true,
      isNsfw: piece.is_nsfw ?? false,
      allowInlineComments: piece.allow_inline_comments ?? true,
      coverImageUrl: piece.cover_image_url ?? null,
    })
    const loaded = dataBlocks.map((b: Parameters<typeof decodeBlock>[0]) =>
      decodeBlock(b)
    )

    yDoc.transact(() => {
      if (yBlocks.length === 0) {
        loaded.forEach((b) => {
          const m = new Y.Map()
          Object.entries(b).forEach(([k, v]) => m.set(k, v))
          yBlocks.push([m])
        })
      }
    })

    setActiveUid(loaded[0]?.uid ?? null)
    lastSerialized.current = JSON.stringify(loaded.map(encodeBlock))
    blocksDirty.current = false
    dirtyBlocksRef.current.clear() // the seeding transaction above isn't an edit
    metaDirty.current = false
    setSavedAt(Date.now())
  }, [q.data, pieceId, yDoc, yBlocks, hydrated])

  // ---------- mutations ----------
  const updateBlock = useCallback(
    (uid: string, patch: Partial<BlockDraft>) => {
      yDoc.transact(() => {
        for (let i = 0; i < yBlocks.length; i++) {
          const bMap = yBlocks.get(i)
          if (bMap.get("uid") === uid) {
            const b = bMap.toJSON() as BlockDraft
            const next = { ...b, ...patch }

            // Enforce canonical state for pseudo-kinds (thesis, gated, etc.)
            // so the UI and database representations never desync.
            if (patch.kind !== undefined && patch.kind !== b.kind) {
              if (["thesis", "evidence", "counter", "footnote"].includes(patch.kind)) {
                next.semanticRole = patch.kind
              } else if (patch.kind === "gated") {
                next.semanticRole = null
                next.monetizationEligible = true
              } else if (
                ["paragraph", "heading", "quote", "callout", "code", "citation", "question", "image", "chart", "mermaid", "flowchart", "exercise", "audio_note", "embed"].includes(patch.kind)
              ) {
                // If user selected a base type (like Paragraph) from dropdown,
                // clear the pseudo-kind states to fully revert it.
                if (["thesis", "evidence", "counter", "footnote"].includes(b.kind)) {
                  next.semanticRole = null
                }
                if (b.kind === "gated") {
                  next.monetizationEligible = false
                }
              }
              // Converting a block to a kind that needs seed data (a chart has
              // no meaning without a type, labels and a series) has to fill it
              // in the same way a freshly inserted block does — otherwise the
              // editor shows defaults it never saves and the block renders
              // blank for readers. Existing keys always win.
              next.content = {
                ...makeBlock(patch.kind).content,
                ...next.content,
              }
            } else if (patch.semanticRole !== undefined || patch.monetizationEligible !== undefined) {
              // If user updated attributes via Inspector, promote paragraph to pseudo-kind
              // or demote it back to paragraph, matching `decodeBlock` logic.
              const isDbParagraph =
                !["heading", "quote", "callout", "code", "citation", "question", "image", "chart", "mermaid", "flowchart", "exercise", "audio_note", "embed"].includes(next.kind)
              
              if (isDbParagraph) {
                if (next.semanticRole && ["thesis", "evidence", "counter", "footnote"].includes(next.semanticRole)) {
                  next.kind = next.semanticRole as BlockKind
                } else if (next.monetizationEligible && !next.semanticRole) {
                  next.kind = "gated"
                } else {
                  next.kind = "paragraph"
                }
              }
            }
            
            Object.entries(next).forEach(([k, v]) => bMap.set(k, v))
            break
          }
        }
      })
      dirtyBlocksRef.current.add(uid)
      blocksDirty.current = true
    },
    [yDoc, yBlocks]
  )

  const updateBlockContent = useCallback(
    (uid: string, patch: Partial<BlockDraft["content"]>) => {
      yDoc.transact(() => {
        for (let i = 0; i < yBlocks.length; i++) {
          const bMap = yBlocks.get(i)
          if (bMap.get("uid") === uid) {
            const currentContent = bMap.get("content") || {}
            bMap.set("content", { ...currentContent, ...patch })
            break
          }
        }
      })
      dirtyBlocksRef.current.add(uid)
      blocksDirty.current = true
    },
    [yDoc, yBlocks]
  )

  const insertBlock = useCallback(
    (afterUid: string | null, kind: BlockKind) => {
      const nb = makeBlock(kind)
      const m = new Y.Map()
      Object.entries(nb).forEach(([k, v]) => m.set(k, v))

      yDoc.transact(() => {
        if (!afterUid) {
          yBlocks.push([m])
        } else {
          let found = false
          for (let i = 0; i < yBlocks.length; i++) {
            if (yBlocks.get(i).get("uid") === afterUid) {
              yBlocks.insert(i + 1, [m])
              found = true
              break
            }
          }
          if (!found) yBlocks.push([m])
        }
      }, STRUCTURAL_ORIGIN)
      setActiveUid(nb.uid)
      dirtyBlocksRef.current.add(nb.uid)
      blocksDirty.current = true
    },
    [yDoc, yBlocks]
  )

  /** Insert a fully-formed block (e.g. from the Retrieval Assistant) after the active block. */
  const insertReadyBlock = useCallback(
    (nb: BlockDraft) => {
      const m = new Y.Map()
      Object.entries(nb).forEach(([k, v]) => m.set(k, v))
      
      yDoc.transact(() => {
        if (!activeUid) {
          yBlocks.push([m])
        } else {
          let found = false
          for (let i = 0; i < yBlocks.length; i++) {
            if (yBlocks.get(i).get("uid") === activeUid) {
              yBlocks.insert(i + 1, [m])
              found = true
              break
            }
          }
          if (!found) yBlocks.push([m])
        }
      }, STRUCTURAL_ORIGIN)
      setActiveUid(nb.uid)
      dirtyBlocksRef.current.add(nb.uid)
      blocksDirty.current = true
      toast.success("Inserted from archive")
    },
    [activeUid, yDoc, yBlocks]
  )

  const moveBlock = useCallback(
    (uid: string, dir: -1 | 1) => {
      yDoc.transact(() => {
        for (let i = 0; i < yBlocks.length; i++) {
          if (yBlocks.get(i).get("uid") === uid) {
            const j = i + dir
            if (j < 0 || j >= yBlocks.length) break
            const m1 = yBlocks.get(i)
            const m2 = yBlocks.get(j)
            const clone1 = new Y.Map()
            Object.entries(m1.toJSON()).forEach(([k,v]) => clone1.set(k,v))
            const clone2 = new Y.Map()
            Object.entries(m2.toJSON()).forEach(([k,v]) => clone2.set(k,v))
            
            yBlocks.delete(Math.min(i, j), 2)
            if (dir === -1) {
               yBlocks.insert(j, [clone1, clone2])
            } else {
               yBlocks.insert(i, [clone2, clone1])
            }
            break
          }
        }
      }, STRUCTURAL_ORIGIN)
      blocksDirty.current = true
    },
    [yDoc, yBlocks]
  )

  const removeBlock = useCallback(
    (uid: string) => {
      yDoc.transact(() => {
        for (let i = 0; i < yBlocks.length; i++) {
          if (yBlocks.get(i).get("uid") === uid) {
            yBlocks.delete(i, 1)
            break
          }
        }
      }, STRUCTURAL_ORIGIN)
      blocksDirty.current = true
    },
    [yDoc, yBlocks]
  )

  const reorderTo = useCallback(
    (sourceUid: string, targetUid: string) => {
      yDoc.transact(() => {
        let si = -1, ti = -1
        for (let i = 0; i < yBlocks.length; i++) {
          if (yBlocks.get(i).get("uid") === sourceUid) si = i
          if (yBlocks.get(i).get("uid") === targetUid) ti = i
        }
        if (si >= 0 && ti >= 0 && si !== ti) {
          const m1 = yBlocks.get(si)
          const clone1 = new Y.Map()
          Object.entries(m1.toJSON()).forEach(([k,v]) => clone1.set(k,v))
          yBlocks.delete(si, 1)
          
          // Recompute target index since array length changed
          ti = -1
          for (let i = 0; i < yBlocks.length; i++) {
            if (yBlocks.get(i).get("uid") === targetUid) ti = i
          }
          if (ti >= 0) yBlocks.insert(ti, [clone1])
        }
      }, STRUCTURAL_ORIGIN)
      blocksDirty.current = true
    },
    [yDoc, yBlocks]
  )

  // ---------- autosave ----------
  const [saveQueue] = useState(createSaveQueue)

  // Fix #4: always-current ref so flushBlocks never reads stale closure blocks
  const blocksRef = useRef(blocks)
  useEffect(() => { blocksRef.current = blocks }, [blocks])

  const flushBlocks = useCallback(async () => {
    // Paused while a version restore runs; blocksDirty stays set. Nothing new
    // to send: still wait for a save in flight, so callers (schedule, publish,
    // unmount) never outrun it.
    if (!blocksDirty.current || saveQueue.paused) return saveQueue.idle()
    // Fix #4: read from ref so unmount flush always has the latest blocks
    const payload = blocksRef.current.map((b) => ({
      ...encodeBlock(b),
      is_dirty: dirtyBlocksRef.current.has(b.uid),
    }))
    const ser = JSON.stringify(blocksRef.current.map(encodeBlock))
    if (ser === lastSerialized.current) {
      blocksDirty.current = false
      return saveQueue.idle()
    }

    if (!navigator.onLine) {
      if (mountedRef.current) setSavedAt(Date.now())
      return // Needs server sync eventually, blocksDirty remains true
    }

    blocksDirty.current = false // optimistic
    const dirtySet = new Set(dirtyBlocksRef.current)
    dirtyBlocksRef.current.clear()

    if (mountedRef.current) setSaving(true)
    const run = saveQueue.enqueue(async () => {
      try {
        await saveBlocks({
          data: { content_object_id: pieceId, blocks: payload },
        })
        lastSerialized.current = ser
        if (mountedRef.current) setSavedAt(Date.now())
      } catch (e) {
        blocksDirty.current = true // revert
        // restore dirty blocks if failed
        dirtySet.forEach(uid => dirtyBlocksRef.current.add(uid))
        if (mountedRef.current) toast.error((e as Error).message)
      }
    })
    // Fix #6: guard setSaving(false) with mountedRef
    await run.finally(() => { if (mountedRef.current) setSaving(false) })
  }, [pieceId, saveQueue])

  // Version restore fencing (see save-queue.ts): wait for the save in flight,
  // drop queued pre-restore saves, pause autosave until the restore returns.
  const beforeRestore = useCallback(() => saveQueue.beginRestore(), [saveQueue])
  const afterRestore = useCallback(
    (ok: boolean) => {
      if (!ok) {
        // Restore failed: a dropped queued save may have held edits — resend all.
        blocksRef.current.forEach((b) => dirtyBlocksRef.current.add(b.uid))
        blocksDirty.current = true
      }
      saveQueue.endRestore()
      // Edits typed while the restore ran shouldn't wait for the next keystroke.
      void flushBlocks()
    },
    [saveQueue, flushBlocks]
  )

  // debounced server sync
  useEffect(() => {
    if (!q.data?.piece) return
    const t = setTimeout(() => {
      if (blocksDirty.current) void flushBlocks()
    }, AUTOSAVE_MS)
    return () => clearTimeout(t)
  }, [blocks, flushBlocks, q.data])

  const handleBlocksUpdated = useCallback(
    (snapshot: Record<string, unknown>[]) => {
      // snapshot entries are the block rows the restore just inserted (with
      // their new ids). They must be run back through decodeBlock before
      // entering the Yjs array: pushing the raw rows leaves blocks with no
      // uid/kind/modeVisibility and the next render throws. The server already
      // holds exactly this state, so adopt it as saved — a pending dirty set
      // from before the restore would otherwise re-send stale blocks.
      const decoded = snapshot.map((b) =>
        decodeBlock(b as Parameters<typeof decodeBlock>[0])
      )
      yDoc.transact(() => {
        yBlocks.delete(0, yBlocks.length)
        decoded.forEach((b) => {
          const m = new Y.Map()
          Object.entries(b).forEach(([k, v]) => m.set(k, v))
          yBlocks.push([m])
        })
      }, STRUCTURAL_ORIGIN)
      lastSerialized.current = JSON.stringify(decoded.map(encodeBlock))
      dirtyBlocksRef.current.clear()
      blocksDirty.current = false
    },
    [yDoc, yBlocks]
  )

  // auto-commit every 10 minutes
  // Fix #3: stable interval — blocksRef avoids stale closure and dep-array re-creation on every render
  useEffect(() => {
    if (!q.data?.piece) return
    let lastCommittedSer = lastSerialized.current
    const t = setInterval(async () => {
      if (blocksRef.current.length === 0) return
      const currentSer = JSON.stringify(blocksRef.current.map(encodeBlock))
      if (currentSer !== lastCommittedSer) {
        try {
          await createPieceVersion({
            data: {
              piece_id: pieceId,
              message: "Auto-save",
              is_auto: true,
              blocks_snapshot: JSON.parse(currentSer),
            },
          })
          lastCommittedSer = currentSer
        } catch (e) {
          console.error("Auto-commit failed", e)
        }
      }
    }, 10 * 60 * 1000) // 10 minutes
    return () => clearInterval(t)
  }, [pieceId, q.data?.piece])

  const flushMeta = useCallback(
    async (extra: Record<string, unknown> = {}): Promise<boolean> => {
      if (!metaDirty.current && Object.keys(extra).length === 0) return true
      setSaving(true)
      try {
        await updatePiece({
          data: {
            id: pieceId,
            title: title.trim() || "Untitled",
            summary: summary || null,
            canonical_thesis: thesis || null,
            tags: tags
              .split(",")
              .map((t: string) => t.trim())
              .filter(Boolean),
            tips_enabled: tipsEnabled,
            sponsorship_enabled: sponsorshipEnabled,
            repost_credits_required: repostCreditsRequired,
            is_nsfw: isNsfw,
            allow_inline_comments: allowInlineComments,
            cover_image_url: coverImageUrl,
            ...extra,
          },
        })
        metaDirty.current = false
        if (mountedRef.current) setSavedAt(Date.now())
        return true
      } catch (e) {
        if (mountedRef.current) toast.error((e as Error).message)
        return false
      } finally {
        if (mountedRef.current) setSaving(false)
      }
    },
    [
      pieceId,
      title,
      summary,
      thesis,
      tags,
      tipsEnabled,
      sponsorshipEnabled,
      repostCreditsRequired,
      isNsfw,
      allowInlineComments,
      coverImageUrl,
    ]
  )

  const prevOnline = useRef(isOnline)
  useEffect(() => {
    if (isOnline && !prevOnline.current) {
      if (blocksDirty.current) void flushBlocks()
      if (metaDirty.current) void flushMeta()
    }
    prevOnline.current = isOnline
  }, [isOnline, flushBlocks, flushMeta])

  const isLoaded = !!q.data?.piece
  const initialMetaLoad = useRef(true)
  useEffect(() => {
    if (!isLoaded) return
    if (initialMetaLoad.current) {
      initialMetaLoad.current = false
      return
    }
    metaDirty.current = true
    const t = setTimeout(() => {
      void flushMeta()
    }, AUTOSAVE_MS)
    return () => clearTimeout(t)
  // meta is a single object — no need to list every field separately
  }, [meta, flushMeta, isLoaded])

  // flush on unmount
  useEffect(
    () => () => {
      void flushBlocks()
      void flushMeta()
    },
    [flushBlocks, flushMeta]
  )

  const togglePublish = useCallback(async () => {
    await flushBlocks()
    const ok = await flushMeta({
      status: status === "published" ? "draft" : "published",
    })
    if (!ok) return
    toast.success(status === "published" ? "Unpublished" : "Published")
    await q.refetch()
  }, [flushBlocks, flushMeta, status, q])

  // keyboard shortcut: Cmd/Ctrl+S (save), Cmd/Ctrl+Enter (publish/unpublish)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault()
        void flushBlocks()
        void flushMeta()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        void togglePublish()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [flushBlocks, flushMeta, togglePublish])

  const reviewVariant = useCallback(
    (uid: string, mode: ReadingMode) => {
      setDiffingUid(uid)
      setDiffingMode(mode)
      setActiveUid(uid)
      updateActiveBlock(uid)
    },
    [updateActiveBlock]
  )

  // ---------- AI ----------
  const generateVariant = useCallback(
    async (uid: string, mode: ReadingMode) => {
      const b = blocks.find((x) => x.uid === uid)
      if (!b) return
      const src = (b.content.html || b.content.text || "")
        .replace(/<[^>]+>/g, " ")
        .trim()
      if (!src) {
        toast.error("Block is empty")
        return
      }
      setAiBlockBusy(true)
      try {
        const { text } = await generateModeVariant({
          data: { mode, source: src, blockType: b.kind },
        })
        updateBlockContent(uid, {
          aiVariants: {
            ...(b.content.aiVariants ?? {}),
            [mode]: { text, html: `<p>${text.replace(/\n/g, "<br/>")}</p>` },
          },
        })
        reviewVariant(uid, mode)
        toast.success(`Generated ${mode} variant`)
      } catch (e) {
        toast.error((e as Error).message)
      } finally {
        setAiBlockBusy(false)
      }
    },
    [blocks, updateBlockContent, reviewVariant]
  )

  const acceptDiff = useCallback(() => {
    if (!diffingUid || !diffingMode) return
    // Actually promote the variant into the block's content — not just close the
    // diff. Without this, "Apply" was a no-op and the generated text was lost.
    const b = blocks.find((x) => x.uid === diffingUid)
    const variant = b?.content.aiVariants?.[diffingMode]
    if (b && variant) {
      const nextVariants = { ...b.content.aiVariants }
      delete nextVariants[diffingMode]
      updateBlockContent(diffingUid, {
        text: variant.text ?? b.content.text,
        html: variant.html ?? b.content.html,
        aiVariants: nextVariants,
      })
    }
    setDiffingUid(null)
    setDiffingMode(null)
    toast.success(`Variant applied`)
  }, [blocks, diffingUid, diffingMode, updateBlockContent])

  const discardDiff = useCallback(() => {
    if (!diffingUid || !diffingMode) return
    const b = blocks.find((x) => x.uid === diffingUid)
    if (b && b.content.aiVariants) {
      const newVariants = { ...b.content.aiVariants }
      delete newVariants[diffingMode]
      updateBlockContent(diffingUid, { aiVariants: newVariants })
    }
    setDiffingUid(null)
    setDiffingMode(null)
  }, [blocks, diffingUid, diffingMode, updateBlockContent])

  const suggestMeta = useCallback(async () => {
    const blocksText = blocks
      .map((b) =>
        b.content.html
          ? b.content.html.replace(/<[^>]+>/g, " ")
          : b.content.text
      )
      .join("\n\n")
      .trim()
    if (!blocksText) {
      toast.error("Add content first")
      return
    }
    setAiMetaBusy(true)
    try {
      const { summary: s, thesis: t, tags: tg } = await suggestPieceMeta({
        data: { title, blocksText },
      })
      if (s) setSummary(s)
      if (t) setThesis(t)
      if (tg) setTags(tg)
      toast.success("Suggested — review & autosave will commit")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setAiMetaBusy(false)
    }
  }, [blocks, title])

  // ---------- slash menu ----------
  const handleSlashTrigger = (
    uid: string,
    rect: DOMRect,
    query: string = ""
  ) => {
    setSlash({ uid, anchor: { x: rect.left, y: rect.bottom }, query })
  }
  // Only the block that opened the menu may close it.
  const handleSlashClose = (uid: string) =>
    setSlash((s) => (s?.uid === uid ? null : s))
  const handleSlashSelect = (kind: BlockKind) => {
    if (!slash) return
    const b = blocks.find((x) => x.uid === slash.uid)
    if (!b) {
      setSlash(null)
      return
    }

    // Fix #9: Strip the trailing "/<query>" from content robustly.
    // We strip from plain text first, then rebuild html from remaining text
    // to avoid the fragile regex approach that broke on rich marks like <strong>.
    const rawText = b.content.text || ""
    // Remove everything from the last "/" to the end (slash + any query chars)
    const strippedText = rawText.replace(/\/[A-Za-z0-9_-]*\s*$/, "")
    const isEmpty = !strippedText.trim()

    if (isEmpty) {
      // Convert this block to the chosen kind in place
      const fresh = makeBlock(kind)
      updateBlock(slash.uid, {
        kind,
        semanticRole: fresh.semanticRole,
        monetizationEligible: fresh.monetizationEligible,
        content: { ...b.content, text: "", html: "" },
      })
      setActiveUid(slash.uid)
    } else {
      // For the html we use a simple text-strip since the slash is always at the end
      const strippedHtml = (b.content.html || "")
        .replace(/\/[A-Za-z0-9_-]*(<\/[a-z0-9]+>(\s*))?$/, "$1")
        .trim()
      updateBlockContent(slash.uid, { text: strippedText, html: strippedHtml })
      insertBlock(slash.uid, kind)
    }
    setSlash(null)
  }

  useEffect(() => {
    if (!savedAt) return
    const update = () => {
      const s = Math.round((Date.now() - savedAt) / 1000)
      if (s < 5) setSavedAgo("just now")
      else if (s < 60) setSavedAgo(`${s}s ago`)
      else if (s < 3600) setSavedAgo(`${Math.round(s / 60)}m ago`)
      else setSavedAgo(new Date(savedAt).toLocaleTimeString())
    }
    update()
    const t = setInterval(update, 5000)
    return () => clearInterval(t)
  }, [savedAt])

  const onDelete = async () => {
    await deletePiece({ data: { id: pieceId } })
    toast.success("Piece deleted")
    router.push("/studio/drafts")
  }

  // Scroll to active
  const scrollTo = (uid: string) => {
    setActiveUid(uid)
    document
      .querySelector(`[data-block-uid="${uid}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  const handleScheduleClear = useCallback(async () => {
    const ok = await flushMeta({ status: "draft", scheduled_for: null })
    if (ok) await q.refetch()
    return ok
  }, [flushMeta, q])

  const handleScheduleSubmit = useCallback(
    async (when: Date) => {
      await flushBlocks()
      const ok = await flushMeta({
        status: "scheduled",
        scheduled_for: when.toISOString(),
      })
      if (ok) await q.refetch()
      return ok
    },
    [flushBlocks, flushMeta, q]
  )

  if (q.isLoading)
    return <div className="p-8 text-muted-foreground">Loading composer…</div>
  if (q.isError)
    return (
      <div className="p-8 text-destructive">
        <h2 className="font-bold">Error loading piece:</h2>
        <pre className="mt-4 whitespace-pre-wrap rounded bg-destructive/10 p-4 text-sm">
          {q.error instanceof Error ? q.error.message : JSON.stringify(q.error, null, 2)}
        </pre>
      </div>
    )
  if (!q.data?.piece)
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <div>
          <h2 className="font-display text-2xl text-foreground">Piece not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This draft doesn&apos;t exist or you don&apos;t have access to it.
          </p>
        </div>
        <Button onClick={() => router.push("/studio/drafts")}>
          <ChevronLeft className="mr-1 size-4" /> Back to drafts
        </Button>
      </div>
    )

  const active = blocks.find((b) => b.uid === activeUid) ?? null

  // Below lg the panes are sheets (closed by default) so they never cover the
  // editor; at lg+ they are the collapsible side columns. Crossing 1024px
  // remounts the panes (local tab/scroll state resets) — acceptable.
  const outlinePane = (setCollapsed: (c: boolean) => void) => (
              <OutlinePane
              pieceId={pieceId}
              blocks={blocks}
              activeUid={activeUid}
              onJump={scrollTo}
              onRestore={(snapshot) => handleBlocksUpdated(snapshot)}
              beforeRestore={beforeRestore}
              afterRestore={afterRestore}
              onCollapse={() => setCollapsed(true)}
              onUpdateBlock={updateBlock}
            />
  )
  const inspectorPane = (setCollapsed: (c: boolean) => void) => (
              <InspectorAside
                pieceId={pieceId}
                inspectorTab={inspectorTab}
                setInspectorTab={setInspectorTab}
                setInspectorCollapsed={setCollapsed}
                active={active}
                blocks={blocks}
                scrollToBlock={(uid) => {
                  // Cards tag themselves with data-block-uid, not id="block-…",
                  // so getElementById always missed and the jump was a no-op.
                  const el = document.querySelector(`[data-block-uid="${uid}"]`)
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" })
                    setActiveUid(uid)
                  }
                }}
                updateBlock={updateBlock}
                generateVariant={generateVariant}
                aiBlockBusy={aiBlockBusy}
                reviewVariant={reviewVariant}
                insertReadyBlock={insertReadyBlock}
              />
  )
  const openInspector = () => {
    if (wide) setInspectorCollapsed(false)
    else setInspectorSheet(true)
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <ComposerHeader
        status={status}
        slug={slug}
        saving={saving}
        savedAgo={savedAgo}
        previewMode={previewMode}
        setPreviewMode={setPreviewMode}
        readerPreview={readerPreview}
        setReaderPreview={setReaderPreview}
        heatmapEnabled={heatmapEnabled}
        setHeatmapEnabled={setHeatmapEnabled}
        setShowMeta={setShowMeta}
        setShowSchedule={setShowSchedule}
        openInspector={openInspector}
        setInspectorTab={setInspectorTab}
        onShowMinimap={() => setShowMinimap(true)}
        onSave={() => {
          void flushBlocks()
          void flushMeta()
        }}
        onPublish={togglePublish}
        onDelete={onDelete}
        titleText={q.data.piece.title || "delete"}
        pieceId={pieceId}
        authorHandle={currentUser?.handle ?? ""}
        onStartTour={startTour}
        onUndo={onUndo}
        onRedo={onRedo}
      />

      {/* Body: three panes */}
      <div className="flex min-h-0 flex-1 relative overflow-hidden">
        {/* Outline */}
        {wide && <aside 
          id="tour-outline"
          className={`z-20 transition-all duration-300 ease-in-out bg-background hairline-r shrink-0 overflow-hidden ${
            outlineCollapsed 
              ? "w-8 relative"  
              : "w-65"
          }`}
        >
          {outlineCollapsed ? (
            <button
              onClick={() => setOutlineCollapsed(false)}
              className="absolute inset-0 flex items-start justify-center pt-4 text-[10px] tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:bg-accent/50 hover:text-foreground"
              title="Expand outline"
            >
              <span className="rotate-180 [writing-mode:vertical-rl]">
                « outline & history
              </span>
            </button>
          ) : (
            <div className="h-full w-full overflow-y-auto">
              {outlinePane((c) => setOutlineCollapsed(c))}
            </div>
          )}
        </aside>}


        {/* Canvas & Overlay Wrapper */}
        <div id="tour-canvas" className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {!wide && (
            <div className="hairline-b flex shrink-0 items-center justify-between px-2 py-1">
              <Sheet open={outlineSheet} onOpenChange={setOutlineSheet}>
                <SheetTrigger asChild>
                  <Button id="tour-outline-button" size="sm" variant="ghost">
                    <PanelLeft className="mr-1 size-4" /> Outline
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[85vw] max-w-sm p-0 [&>button:first-child]:hidden">
                  <SheetTitle className="sr-only">Outline & history</SheetTitle>
                  {outlinePane((c) => setOutlineSheet(!c))}
                </SheetContent>
              </Sheet>
              <Sheet open={inspectorSheet} onOpenChange={setInspectorSheet}>
                <SheetTrigger asChild>
                  <Button id="tour-inspector-button" size="sm" variant="ghost">
                    Inspector <PanelRight className="ml-1 size-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[85vw] max-w-sm overflow-y-auto p-0 [&>button:first-child]:hidden">
                  <SheetTitle className="sr-only">Inspector & archive</SheetTitle>
                  {inspectorPane((c) => setInspectorSheet(!c))}
                </SheetContent>
              </Sheet>
            </div>
          )}
          <CanvasArea
            title={title}
            setTitle={setTitle}
            coverImageUrl={coverImageUrl}
            summary={summary}
            readerPreview={readerPreview}
            previewMode={previewMode}
            heatmapEnabled={heatmapEnabled}
            diffingUid={diffingUid}
            diffingMode={diffingMode}
            blocks={blocks}
            activeUid={activeUid}
            setActiveUid={setActiveUid}
            presences={presences}
            generateVariant={generateVariant}
            acceptDiff={acceptDiff}
            discardDiff={discardDiff}
            updateBlock={updateBlock}
            updateBlockContent={updateBlockContent}
            insertBlock={insertBlock}
            moveBlock={moveBlock}
            removeBlock={removeBlock}
            reorderTo={reorderTo}
            handleSlashTrigger={handleSlashTrigger}
            handleSlashClose={handleSlashClose}
            repostFooter={
              q.data?.originalPiece && q.data?.originalBlocks ? (
                <div className="rounded-xl border border-border/50 bg-muted/20 shadow-sm">
                  <EmbeddedRepost
                    piece={q.data.originalPiece}
                    author={q.data.originalAuthor ?? null}
                    blocks={q.data.originalBlocks}
                  />
                </div>
              ) : undefined
            }
            ydoc={yDoc}
            provider={{ awareness }}
            currentUser={currentUser}
          />
        </div>

        {/* Inspector */}
        {wide && <aside 
          id="tour-inspector"
          className={`z-20 transition-all duration-300 ease-in-out bg-background hairline-l shrink-0 overflow-hidden ${
            inspectorCollapsed 
              ? "w-8 relative"  
              : "w-[320px]"
          }`}
        >
          {inspectorCollapsed ? (
            <button
              onClick={() => setInspectorCollapsed(false)}
              className="absolute inset-0 flex items-start justify-center pt-4 text-[10px] tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:bg-accent/50 hover:text-foreground"
              title="Expand inspector"
            >
              <span className="rotate-180 [writing-mode:vertical-rl]">
                « inspector & archive
              </span>
            </button>
          ) : (
            <div className="h-full w-full overflow-y-auto">
              {inspectorPane(setInspectorCollapsed)}
            </div>
          )}
        </aside>}
      </div>


      {/* Slash menu */}
      {slash && (
        <SlashMenu
          anchor={slash.anchor}
          query={slash.query}
          onSelect={handleSlashSelect}
          onClose={() => setSlash(null)}
        />
      )}

      {/* Meta dialog */}
      <MetaDialog
        pieceId={pieceId}
        open={showMeta}
        onOpenChange={setShowMeta}
        summary={summary}
        setSummary={setSummary}
        thesis={thesis}
        setThesis={setThesis}
        tags={tags}
        setTags={setTags}
        tipsEnabled={tipsEnabled}
        setTipsEnabled={setTipsEnabled}
        sponsorshipEnabled={sponsorshipEnabled}
        setSponsorshipEnabled={setSponsorshipEnabled}
        repostCreditsRequired={repostCreditsRequired}
        setRepostCreditsRequired={setRepostCreditsRequired}
        isNsfw={isNsfw}
        setIsNsfw={setIsNsfw}
        allowInlineComments={allowInlineComments}
        setAllowInlineComments={setAllowInlineComments}
        onSuggestMeta={suggestMeta}
        aiMetaBusy={aiMetaBusy}
      />

      {/* Schedule dialog */}
      <ScheduleDialog
        open={showSchedule}
        onOpenChange={setShowSchedule}
        status={status}
        scheduledFor={q.data.piece.scheduled_for}
        onSchedule={handleScheduleSubmit}
        onClear={handleScheduleClear}
      />
      {/* Minimap dialog */}
      <MinimapDialog
        open={showMinimap}
        onOpenChange={setShowMinimap}
        blocks={blocks}
      />
      
      <VoiceDictation
        onTranscript={(text) => {
          // Insert through the Yjs array, not setBlocks: `blocks` is re-synced
          // from yBlocks on every change, so a setBlocks-only insert is wiped by
          // the next edit and never reaches collaborators or the server.
          const nb = makeBlock("paragraph")
          nb.content.text = text
          nb.content.html = textToParagraphHtml(text)
          insertReadyBlock(nb)
        }}
      />
    </div>
  )
}
