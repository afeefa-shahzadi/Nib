/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  KIND_META,
  MODES,
  type BlockDraft,
  type ReadingMode,
  htmlToText,
  encodeBlock,
} from "./types"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { listPieceVersions, restorePieceVersion, createPieceVersion, getPieceVersion } from "@/actions/content"
import { diffWords } from "diff"
import { CommitDialog } from "./commit-dialog"
import { toast } from "sonner"
import { RotateCcw } from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Props {
  pieceId: string
  blocks: BlockDraft[]
  activeUid: string | null
  onJump: (uid: string) => void
  onRestore: (blocksSnapshot: Record<string, unknown>[]) => void
  /** Fence autosave around the restore (wait for in-flight save, pause). */
  beforeRestore?: () => Promise<void>
  afterRestore?: (ok: boolean) => void
  onCollapse: () => void
  onUpdateBlock?: (uid: string, patch: Partial<BlockDraft>) => void
}

function preview(b: BlockDraft): string {
  if (b.outlineLabel) return b.outlineLabel
  if (b.kind === "citation")
    return b.content.source || b.content.url || "(citation)"
  if (b.kind === "code") return b.content.text.split("\n")[0] || "(code)"
  if (b.kind === "heading") return b.content.text || "(heading)"
  const raw = b.content.html ? htmlToText(b.content.html) : b.content.text
  return raw || `(empty ${b.kind})`
}

const MODE_DOT_COLOR: Record<ReadingMode, string> = {
  skim: "var(--note)",
  standard: "var(--primary)",
  expert: "var(--success)",
  teach: "var(--info)",
  debate: "var(--destructive)",
}

export function OutlinePane({ pieceId, blocks, activeUid, onJump, onRestore, beforeRestore, afterRestore, onCollapse, onUpdateBlock }: Props) {
  const [editingLabelUid, setEditingLabelUid] = useState<string | null>(null)
  const [labelInputValue, setLabelInputValue] = useState("")
  const [comparing, setComparing] = useState<{
    v1Name: string
    v2Name: string
    diffs: import("diff").Change[]
  } | null>(null)

  const { data: versions, refetch } = useQuery({
    queryKey: ["piece-versions", pieceId],
    queryFn: () => listPieceVersions({ data: { piece_id: pieceId } }),
  })

  const handleCommit = async (message: string) => {
    try {
      const payload = blocks.map(encodeBlock)
      await createPieceVersion({
        data: {
          piece_id: pieceId,
          message,
          blocks_snapshot: payload,
          is_auto: false,
        },
      })
      toast.success("Version saved")
      refetch()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleRestore = async (versionId: string) => {
    await beforeRestore?.()
    let ok = false
    try {
      const { blocks: restoredBlocks } = await restorePieceVersion({ data: { version_id: versionId } })
      onRestore(restoredBlocks)
      ok = true
      toast.success("Restored version")
      refetch()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      afterRestore?.(ok)
    }
  }

  const handleCompare = async (v2Index: number) => {
    if (!versions) return
    const v2Meta = versions[v2Index]
    const v1Meta = versions[v2Index + 1]
    
    if (!v1Meta) {
      toast.error("This is the oldest version. Nothing to compare to.")
      return
    }

    const loadToast = toast.loading("Loading versions for comparison...")
    try {
      const [v2, v1] = await Promise.all([
        getPieceVersion({ data: { version_id: v2Meta.id } }),
        getPieceVersion({ data: { version_id: v1Meta.id } })
      ])

      const extractText = (snap: any[]) => snap.map(b => {
        const html = b.content?.html || ""
        const text = b.content?.text || ""
        return htmlToText(html || text)
      }).join("\n\n")

      const text1 = extractText(v1.blocks_snapshot || [])
      const text2 = extractText(v2.blocks_snapshot || [])

      const diffs = diffWords(text1, text2)

      setComparing({
        v1Name: v1Meta.message || `Version ${versions.length - v2Index - 1}`,
        v2Name: v2Meta.message || `Version ${versions.length - v2Index}`,
        diffs
      })
      toast.dismiss(loadToast)
    } catch {
      toast.dismiss(loadToast)
      toast.error("Failed to load versions for comparison")
    }
  }

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="outline" className="flex h-full flex-col">
        <div className="hairline-b flex items-center justify-between px-3 pt-3 pb-2">
          <button
            onClick={onCollapse}
            className="flex items-center justify-center size-8 -ml-2 text-[10px] tracking-[0.15em] text-muted-foreground uppercase hover:text-foreground hover:bg-accent/50 rounded"
            title="Collapse outline"
          >
            «
          </button>
          <TabsList className="bg-transparent p-0 flex items-center gap-1 h-auto">
            <TabsTrigger
              value="outline"
              className="rounded px-2 py-1 text-[10px] tracking-[0.15em] uppercase data-[state=active]:bg-accent data-[state=active]:text-foreground text-muted-foreground hover:text-foreground shadow-none data-[state=active]:shadow-none font-normal"
            >
              Outline
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded px-2 py-1 text-[10px] tracking-[0.15em] uppercase data-[state=active]:bg-accent data-[state=active]:text-foreground text-muted-foreground hover:text-foreground shadow-none data-[state=active]:shadow-none font-normal"
            >
              History
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="outline" className="flex-1 overflow-y-auto p-4 m-0 data-[state=inactive]:hidden">
          <div className="mb-2 flex items-center justify-between px-2">
            <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Blocks
            </p>
            <div
              className="flex items-center gap-0.5"
              title="Mode visibility (legend)"
              aria-label="Reading mode legend"
            >
              {MODES.map((m) => (
                <span
                  key={m}
                  className="inline-block size-1.5 rounded-full"
                  style={{ background: MODE_DOT_COLOR[m] }}
                  title={m}
                />
              ))}
            </div>
          </div>
          {blocks.length === 0 && (
            <p className="px-2 text-xs text-muted-foreground">No blocks yet.</p>
          )}
          <div className="space-y-1">
            {blocks.map((b, i) => {
              const visibleCount = MODES.filter((m) => b.modeVisibility[m]).length
              const restricted = visibleCount < MODES.length
              return (
                <div
                  key={b.uid}
                  onDoubleClick={() => {
                    if (onUpdateBlock) {
                      setEditingLabelUid(b.uid)
                      setLabelInputValue(b.outlineLabel || "")
                    }
                  }}
                  className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-xs ${
                    activeUid === b.uid
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50"
                  } ${b.kind === "heading" || b.outlineLabel ? "font-medium text-foreground" : ""}`}
                  title={
                    restricted
                      ? `Visible in ${visibleCount}/${MODES.length} modes`
                      : "Visible in every mode"
                  }
                >
                  <button onClick={() => onJump(b.uid)} className="w-4 pt-0.5 text-right text-[10px] tabular-nums opacity-50 hover:opacity-100">
                    {i + 1}
                  </button>
                  <button onClick={() => onJump(b.uid)} className="inline-flex w-4 items-center justify-center pt-0.5 text-[10px] opacity-70 hover:opacity-100">
                    {KIND_META[b.kind].icon}
                  </button>
                  <div className="line-clamp-2 flex-1 leading-snug cursor-default" onClick={() => onJump(b.uid)}>
                    {editingLabelUid === b.uid ? (
                      <input
                        autoFocus
                        value={labelInputValue}
                        onChange={(e) => setLabelInputValue(e.target.value)}
                        onBlur={() => {
                          onUpdateBlock?.(b.uid, { outlineLabel: labelInputValue.trim() || null })
                          setEditingLabelUid(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onUpdateBlock?.(b.uid, { outlineLabel: labelInputValue.trim() || null })
                            setEditingLabelUid(null)
                          }
                          if (e.key === "Escape") {
                            setEditingLabelUid(null)
                          }
                        }}
                        className="w-full bg-transparent outline-none ring-1 ring-primary/50 rounded px-1 -mx-1"
                        placeholder="Block label..."
                      />
                    ) : (
                      preview(b)
                    )}
                  </div>
                  <div
                    className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5"
                    aria-hidden
                  >
                    {MODES.map((m) => (
                      <span
                        key={m}
                        className="size-1 rounded-full transition-opacity"
                        style={{
                          background: MODE_DOT_COLOR[m],
                          opacity: b.modeVisibility[m] ? 0.85 : 0.15,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-y-auto p-4 m-0 data-[state=inactive]:hidden flex flex-col gap-4">
          {!comparing ? (
            <>
              <CommitDialog onCommit={handleCommit} disabled={blocks.length === 0} />
              
              <div className="space-y-3">
                {!versions ? (
                  <p className="text-xs text-muted-foreground">Loading history...</p>
                ) : versions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No versions saved yet.</p>
                ) : (
                  versions.map((v: any, i: number) => (
                    <div key={v.id} className="rounded-md border border-border p-3 text-sm relative group">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-medium text-foreground line-clamp-2">
                          {v.message || `Version ${versions.length - i}`}
                        </p>
                        {v.is_auto && (
                          <span className="shrink-0 text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded">
                            Auto
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {new Date(v.created_at).toLocaleDateString()} {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span>{(Array.isArray(v.author) ? v.author[0]?.display_name : v.author?.display_name) || "Unknown"}</span>
                      </div>
                      
                      <div className="mt-3 hidden group-hover:flex flex-col gap-2">
                        {i < versions.length - 1 && (
                          <button 
                            onClick={() => handleCompare(i)}
                            className="flex w-full items-center justify-center gap-1.5 rounded bg-primary/10 py-1.5 text-xs text-primary font-medium hover:bg-primary/20"
                          >
                            Compare with previous
                          </button>
                        )}
                        <ConfirmDialog
                          trigger={
                            <button className="flex w-full items-center justify-center gap-1.5 rounded bg-muted/50 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                              <RotateCcw className="size-3" />
                              Restore this version
                            </button>
                          }
                          title="Restore version?"
                          description="This will replace your current draft with the blocks from this version. A new commit will be created to preserve your history."
                          confirmLabel="Restore"
                          onConfirm={() => handleRestore(v.id)}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col h-full">
              <div className="bg-primary/10 text-primary px-3 py-2 rounded-md mb-4 text-xs font-medium flex justify-between items-center border border-primary/20">
                <span>Comparing {comparing.v2Name} with {comparing.v1Name}</span>
                <button onClick={() => setComparing(null)} className="hover:underline opacity-80">Close</button>
              </div>
              <div className="flex-1 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed p-2 border border-border rounded-md bg-muted/50 font-mono">
                {comparing.diffs.map((part, i) => {
                  if (part.added) return <ins key={i} className="bg-success/20 text-success no-underline px-0.5 rounded-sm">{part.value}</ins>
                  if (part.removed) return <del key={i} className="bg-destructive/20 text-destructive line-through px-0.5 rounded-sm">{part.value}</del>
                  return <span key={i} className="text-muted-foreground">{part.value}</span>
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
