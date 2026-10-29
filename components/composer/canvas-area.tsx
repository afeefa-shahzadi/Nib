/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import { useRef, useMemo, useEffect, useState, useDeferredValue } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react"
import { CitationContext } from "./citation-context"
import { LinkPreview } from "./extensions/inline-citation-node"
import { BlockCard } from "./block-card"
import { BlockView, type Block as RBlock } from "@/components/block-renderer"
import { MODES, type BlockDraft, type ReadingMode, type BlockKind } from "./types"

interface CanvasAreaProps {
  title: string
  setTitle: (value: string) => void
  coverImageUrl?: string | null
  setCoverImageUrl?: (url: string | null) => void
  summary: string
  readerPreview: boolean
  previewMode: ReadingMode | null
  heatmapEnabled: boolean
  diffingUid: string | null
  diffingMode: ReadingMode | null
  focusModeForBlock?: { uid: string; mode: ReadingMode; ts: number } | null
  blocks: BlockDraft[]
  activeUid: string | null
  setActiveUid: (uid: string | null) => void
  presences?: Record<
    string,
    {
      id: string
      handle: string
      activeBlockId: string | null
      avatar_url?: string
    }
  >
  generateVariant: (uid: string, mode: ReadingMode) => void
  acceptDiff: () => void
  discardDiff: () => void
  updateBlock: (uid: string, patch: Partial<BlockDraft>) => void
  updateBlockContent: (
    uid: string,
    patch: Partial<BlockDraft["content"]>
  ) => void
  insertBlock: (afterUid: string | null, kind: BlockKind) => void
  moveBlock: (uid: string, dir: -1 | 1) => void
  removeBlock: (uid: string) => void
  reorderTo: (sourceUid: string, targetUid: string) => void
  handleSlashTrigger: (uid: string, rect: DOMRect, query: string) => void
  handleSlashClose: (uid: string) => void
  repostFooter?: React.ReactNode
  ydoc?: any
  provider?: any
  currentUser?: any
}

// Fix #16: single source-of-truth for the citation tag pattern
const CITATION_TAG_RE =
  /(<(?:a|span|cite)[^>]*data-(?:type="inline-citation"|citation="true")[^>]*>)/g

export function CanvasArea({
  title,
  setTitle,
  coverImageUrl,
  summary,
  readerPreview,
  previewMode,
  heatmapEnabled,
  diffingUid,
  diffingMode,
  focusModeForBlock,
  blocks,
  activeUid,
  setActiveUid,
  presences = {},
  generateVariant,
  acceptDiff,
  discardDiff,
  updateBlock,
  updateBlockContent,
  insertBlock,
  moveBlock,
  removeBlock,
  reorderTo,
  handleSlashTrigger,
  handleSlashClose,
  repostFooter,
  ydoc,
  provider,
  currentUser,
}: CanvasAreaProps) {
  const deferredBlocks = useDeferredValue(blocks)

  const citations = useMemo(() => {
    const map = new Map<string, string>()
    deferredBlocks.forEach((b) => {
      if (typeof b.content.html === "string") {
        const matches = b.content.html.matchAll(new RegExp(CITATION_TAG_RE.source, "g"))
        for (const match of matches) {
          const tag = match[0]
          const hrefMatch = tag.match(/href="([^"]+)"/) || tag.match(/url="([^"]+)"/) || tag.match(/data-url="([^"]+)"/)
          const labelMatch = tag.match(/data-label="([^"]+)"/) || tag.match(/label="([^"]+)"/)
          if (hrefMatch && labelMatch) {
            if (!map.has(hrefMatch[1])) {
              map.set(hrefMatch[1], labelMatch[1])
            }
          }
        }
      }
      if (b.kind === "citation") {
        const url = typeof b.content.url === "string" ? b.content.url : ""
        const label = typeof b.content.label === "string" ? b.content.label : ""
        if (url && label && !map.has(url)) {
          map.set(url, label)
        }
      }
    })
    return Array.from(map.entries())
      .map(([url, label]) => ({ url, label }))
      .sort((a, b) => {
        const na = parseInt(a.label)
        const nb = parseInt(b.label)
        if (!isNaN(na) && !isNaN(nb)) return na - nb
        return a.label.localeCompare(b.label)
      })
  }, [deferredBlocks])

  const citationContextValue = useMemo(() => {
    const map = new Map<string, string>()
    citations.forEach((c) => map.set(c.url, c.label))
    const nextLabel = citations.length
      ? String(Math.max(...citations.map((c) => parseInt(c.label) || 0)) + 1)
      : "1"
    return { map, nextLabel }
  }, [citations])

  // Fix #1: reentrancy guard — this effect calls updateBlockContent which updates blocks
  // which would re-trigger the effect. The ref prevents oscillation.
  const isRenumbering = useRef(false)

  useEffect(() => {
    if (isRenumbering.current) return
    isRenumbering.current = true

    const urlToLabel = new Map<string, number>()
    
    // Pass 1: find all unique URLs and their current label
    blocks.forEach((b) => {
      if (typeof b.content.html === "string") {
        const matches = b.content.html.matchAll(new RegExp(CITATION_TAG_RE.source, "g"))
        for (const match of matches) {
          const tag = match[0]
          const hrefMatch = tag.match(/href="([^"]+)"/) || tag.match(/url="([^"]+)"/) || tag.match(/data-url="([^"]+)"/)
          const labelMatch = tag.match(/data-label="([^"]+)"/) || tag.match(/label="([^"]+)"/)
          if (hrefMatch) {
            const url = hrefMatch[1]
            const parsed = labelMatch ? parseInt(labelMatch[1]) : NaN
            if (!isNaN(parsed)) {
              if (!urlToLabel.has(url)) urlToLabel.set(url, parsed)
              else urlToLabel.set(url, Math.min(urlToLabel.get(url)!, parsed))
            } else if (!urlToLabel.has(url)) {
              urlToLabel.set(url, 999999)
            }
          }
        }
      }
      if (b.kind === "citation") {
        const url = typeof b.content.url === "string" ? b.content.url : ""
        const labelStr = typeof b.content.label === "string" ? b.content.label : ""
        if (url) {
          const parsed = parseInt(labelStr)
          if (!isNaN(parsed)) {
             if (!urlToLabel.has(url)) urlToLabel.set(url, parsed)
             else urlToLabel.set(url, Math.min(urlToLabel.get(url)!, parsed))
          } else if (!urlToLabel.has(url)) {
             urlToLabel.set(url, 999999)
          }
        }
      }
    })

    // Pass 2: Sort by existing labels and compact sequential numbering
    const sortedUrls = Array.from(urlToLabel.entries()).sort((a, b) => a[1] - b[1])
    const newMap = new Map<string, string>()
    sortedUrls.forEach(([url], index) => {
      newMap.set(url, (index + 1).toString())
    })

    // Pass 3: Update blocks with the compacted labels
    blocks.forEach((b) => {
      if (b.kind === "citation") {
        const url = typeof b.content.url === "string" ? b.content.url : ""
        const labelStr = typeof b.content.label === "string" ? b.content.label : ""
        const correctLabel = newMap.get(url)
        if (url && correctLabel && labelStr !== correctLabel) {
           updateBlockContent(b.uid, { label: correctLabel })
        }
      }
      if (typeof b.content.html === "string") {
        let updatedHtml = b.content.html
        const matches = Array.from(
          updatedHtml.matchAll(new RegExp(CITATION_TAG_RE.source, "g"))
        )

        matches.forEach((match) => {
          const tag = match[0]
          const hrefMatch =
            tag.match(/href="([^"]+)"/) ||
            tag.match(/url="([^"]+)"/) ||
            tag.match(/data-url="([^"]+)"/)
          const labelMatch =
            tag.match(/data-label="([^"]+)"/) || tag.match(/label="([^"]+)"/)

          if (hrefMatch && labelMatch) {
            const url = hrefMatch[1]
            const currentLabel = labelMatch[1]
            const expectedLabel = newMap.get(url)

            if (expectedLabel && currentLabel !== expectedLabel) {
              const escaped = currentLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
              const newTag = tag
                .replace(
                  new RegExp(`data-label="${escaped}"`, "g"),
                  `data-label="${expectedLabel}"`
                )
                .replace(
                  new RegExp(`>${escaped}</(a|span|cite)>`, "g"),
                  `>${expectedLabel}</$1>`
                )
              updatedHtml = updatedHtml.replace(tag, newTag)
            }
          }
        })

        if (updatedHtml !== b.content.html) {
          updateBlockContent(b.uid, { html: updatedHtml })
        }
      }
    })

    // Release after a microtask so the state update from updateBlockContent
    // has been scheduled before we allow the next run.
    Promise.resolve().then(() => {
      isRenumbering.current = false
    })
  }, [blocks, updateBlockContent])

  // drag state (encapsulated within the canvas area)
  const dragUid = useRef<string | null>(null)

  // Fix #5: citation picker state lifted here so it survives BlockCard re-renders
  const [citationPickerUid, setCitationPickerUid] = useState<string | null>(null)

  return (
    <CitationContext.Provider value={citationContextValue}>
      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-3 px-4 pt-10 sm:px-8 pb-96">
        {/* Title (always editable, large) */}
        {!readerPreview && (
          <textarea
            aria-label="Piece title"
            rows={1}
            value={title}
            onChange={(e) => setTitle(e.target.value.replace(/\s*\n\s*/g, " "))}
            onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault() }}
            placeholder="Untitled piece"
            className="field-sizing-content w-full resize-none overflow-hidden bg-transparent py-2 font-display text-3xl leading-tight break-words outline-none placeholder:text-muted-foreground md:text-4xl"
          />
        )}

        {/* Reader preview vs. edit */}
        {readerPreview ? (
          <article className="pt-2">
            {coverImageUrl && (
              <div className="mb-8 w-full overflow-hidden rounded-lg">
                <Image unoptimized width={1200} height={400} src={coverImageUrl} alt="Cover" className="w-full object-cover max-h-100 h-auto" />
              </div>
            )}
            {title && (
              <h1 className="mb-2 font-display text-3xl text-foreground md:text-4xl">
                {title}
              </h1>
            )}
            {summary && <p className="mb-6 text-muted-foreground">{summary}</p>}
            {blocks
              .filter((b) => !previewMode || b.modeVisibility[previewMode])
              .map((b, i) => {
                return <PreviewBlockCarousel key={b.uid} b={b} i={i} previewMode={previewMode} />
              })}
            {blocks.length === 0 && (
              <p className="text-muted-foreground italic">No blocks yet.</p>
            )}
          </article>
        ) : (
          <div id="tour-block-create" className="space-y-2">
            {/* Blocks */}
            {blocks.map((b, i) => {
              const activeCoAuthor = Object.values(presences).find(
                (p) => p.activeBlockId === b.uid
              )
              return (
                <div
                  key={b.uid}
                  className={
                    activeCoAuthor
                      ? "relative rounded-lg ring-2 ring-primary/50"
                      : ""
                  }
                >
                  {activeCoAuthor && (
                    <div className="absolute -top-3 right-2 z-10 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">
                      {activeCoAuthor.avatar_url && (
                        <Image
                          src={activeCoAuthor.avatar_url}
                          alt=""
                          width={12}
                          height={12}
                          unoptimized
                          className="h-3 w-3 rounded-full"
                        />
                      )}
                      {activeCoAuthor.handle} is editing...
                    </div>
                  )}
                  <BlockCard
                    block={b}
                    index={i}
                    isActive={activeUid === b.uid}
                    previewMode={previewMode}
                    heatmapEnabled={heatmapEnabled}
                    ydoc={ydoc}
                    provider={provider}
                    currentUser={currentUser}
                    diffMode={diffingUid === b.uid ? diffingMode : null}
                    focusMode={focusModeForBlock?.uid === b.uid ? focusModeForBlock : undefined}
                    onGenerateVariant={(mode) => generateVariant(b.uid, mode)}
                    onAcceptDiff={acceptDiff}
                    onDiscardDiff={discardDiff}
                    onFocus={() => setActiveUid(b.uid)}
                    onUpdate={(patch) => updateBlock(b.uid, patch)}
                    onUpdateContent={(patch) =>
                      updateBlockContent(b.uid, patch)
                    }
                    onAddBelow={() => insertBlock(b.uid, "paragraph")}
                    onMove={(dir) => moveBlock(b.uid, dir)}
                    onRemove={() => removeBlock(b.uid)}
                    onDragStart={(e) => {
                      dragUid.current = b.uid
                      // Firefox refuses to start a drag unless dataTransfer is
                      // written in dragstart; without this, reorder didn't work
                      // there at all.
                      e.dataTransfer.effectAllowed = "move"
                      e.dataTransfer.setData("text/plain", b.uid)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                    }}
                    onDrop={() => {
                      if (dragUid.current && dragUid.current !== b.uid)
                        reorderTo(dragUid.current, b.uid)
                      dragUid.current = null
                    }}
                    onDragEnd={() => {
                      // Clear even when the drag is cancelled (dropped outside,
                      // Esc) — onDrop never fires then, leaving a stale uid.
                      dragUid.current = null
                    }}
                    onSlashTrigger={(rect, query) =>
                      handleSlashTrigger(b.uid, rect, query)
                    }
                    onSlashClose={() => handleSlashClose(b.uid)}
                    citationPickerOpen={citationPickerUid === b.uid}
                    onCitationPickerOpen={() => setCitationPickerUid(b.uid)}
                    onCitationPickerClose={() => setCitationPickerUid(null)}
                  />
                  {activeCoAuthor && (
                    <div
                      className="absolute inset-0 z-20 cursor-not-allowed bg-transparent"
                      title={`Locked by ${activeCoAuthor.handle}`}
                    />
                  )}
                </div>
              )
            })}

            <button
              onClick={() =>
                insertBlock(blocks[blocks.length - 1]?.uid ?? null, "paragraph")
              }
              className="w-full rounded-md border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              + Add block (or type / inside a block)
            </button>
            {repostFooter && <div className="mt-12">{repostFooter}</div>}
          </div>
        )}

        {/* References List */}
        {citations.length > 0 && (
          <div className="mt-12 border-t border-border pt-8">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              References
            </h3>
            <div className="flex flex-col gap-2">
              {citations.map((cit, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col items-center gap-1">
                    {!readerPreview && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-4 w-4"
                        disabled={idx === 0}
                        onClick={() => {
                          // Fix #12: use a unique per-swap sentinel to avoid collision
                          const swapId = `__SWAP_${Date.now()}_${Math.random()}__`
                          const neighbor = citations[idx - 1]
                          const escA = cit.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                          const escB = neighbor.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                          blocks.forEach((b) => {
                            if (b.kind === "citation") {
                              const url = typeof b.content.url === "string" ? b.content.url : ""
                              const label = typeof b.content.label === "string" ? b.content.label : ""
                              if (url && label) {
                                if (label === cit.label) updateBlockContent(b.uid, { label: neighbor.label })
                                else if (label === neighbor.label) updateBlockContent(b.uid, { label: cit.label })
                              }
                            }
                            if (typeof b.content.html === "string") {
                              let html = b.content.html
                              
                              // First, temporarily label A as swapId
                              html = html.replace(new RegExp(`data-label="${escA}"`, "g"), `data-label="${swapId}"`)
                              html = html.replace(new RegExp(`>${escA}</(a|span|cite)>`, "g"), `>${swapId}</$1>`)
                              
                              // Second, change B to A
                              html = html.replace(new RegExp(`data-label="${escB}"`, "g"), `data-label="${cit.label}"`)
                              html = html.replace(new RegExp(`>${escB}</(a|span|cite)>`, "g"), `>${cit.label}</$1>`)
                              
                              // Finally, change swapId (which was A) to B
                              html = html.replace(new RegExp(`data-label="${swapId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "g"), `data-label="${neighbor.label}"`)
                              html = html.replace(new RegExp(`>${swapId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</(a|span|cite)>`, "g"), `>${neighbor.label}</$1>`)
                              
                              if (html !== b.content.html) updateBlockContent(b.uid, { html })
                            }
                          })
                        }}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                    )}
                    <span className="text-xs font-medium text-muted-foreground mt-1 mb-1">
                      [{cit.label}]
                    </span>
                    {!readerPreview && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-4 w-4"
                        disabled={idx === citations.length - 1}
                        onClick={() => {
                          // Fix #12: safe sentinel for down-swap
                          const swapId = `__SWAP_${Date.now()}_${Math.random()}__`
                          const neighbor = citations[idx + 1]
                          const escA = cit.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                          const escB = neighbor.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                          blocks.forEach((b) => {
                            if (b.kind === "citation") {
                              const url = typeof b.content.url === "string" ? b.content.url : ""
                              const label = typeof b.content.label === "string" ? b.content.label : ""
                              if (url && label) {
                                if (label === cit.label) updateBlockContent(b.uid, { label: neighbor.label })
                                else if (label === neighbor.label) updateBlockContent(b.uid, { label: cit.label })
                              }
                            }
                            if (typeof b.content.html === "string") {
                              let html = b.content.html
                              
                              html = html.replace(new RegExp(`data-label="${escA}"`, "g"), `data-label="${swapId}"`)
                              html = html.replace(new RegExp(`>${escA}</(a|span|cite)>`, "g"), `>${swapId}</$1>`)
                              
                              html = html.replace(new RegExp(`data-label="${escB}"`, "g"), `data-label="${cit.label}"`)
                              html = html.replace(new RegExp(`>${escB}</(a|span|cite)>`, "g"), `>${cit.label}</$1>`)
                              
                              html = html.replace(new RegExp(`data-label="${swapId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "g"), `data-label="${neighbor.label}"`)
                              html = html.replace(new RegExp(`>${swapId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</(a|span|cite)>`, "g"), `>${neighbor.label}</$1>`)
                              
                              if (html !== b.content.html) updateBlockContent(b.uid, { html })
                            }
                          })
                        }}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-center py-1">
                    <LinkPreview url={cit.url} />
                    <div className="mt-2 flex flex-wrap gap-1">
                      {blocks
                        .map((b, i) => {
                          const hasInline = typeof b.content.html === "string" && b.content.html.includes(cit.url)
                          const hasStandalone = b.kind === "citation" && typeof b.content.url === "string" && b.content.url.includes(cit.url)
                          if (hasInline || hasStandalone) {
                            return (
                              <span key={b.uid} className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                Block {(i + 1).toString().padStart(2, "0")}
                              </span>
                            )
                          }
                          return null
                        })
                        .filter(Boolean)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
    </CitationContext.Provider>
  )
}

function PreviewBlockCarousel({ b, i, previewMode }: { b: BlockDraft; i: number; previewMode: ReadingMode | null }) {
  const [localMode, setLocalMode] = useState<ReadingMode>("standard");

  const validModes = useMemo(() => {
    if (previewMode !== null) return [previewMode];
    const vm: ReadingMode[] = [];
    MODES.forEach(m => {
       if (m === "standard") {
          if (b.content.text || b.content.html || (b.content.files && b.content.files.length > 0) || b.content.imageUrl) {
             vm.push("standard");
          }
       } else {
          if (b.content.aiVariants?.[m]) {
             vm.push(m);
          }
       }
    });
    if (vm.length === 0) vm.push("standard");
    return vm;
  }, [b.content, previewMode]);

  const actualMode = validModes.includes(localMode) ? localMode : validModes[0];

  const switchMode = (dir: -1 | 1) => {
    const idx = validModes.indexOf(actualMode);
    const newIdx = (idx + dir + validModes.length) % validModes.length;
    setLocalMode(validModes[newIdx]);
  }

  let mergedContent = b.content;
  if (actualMode !== "standard") {
    const variant = b.content.aiVariants?.[actualMode] || {};
    const baseFiles = b.content.files ? JSON.parse(JSON.stringify(b.content.files)) : [];
    baseFiles.forEach((f: { content: string }) => f.content = "");
    
    if (variant.text && !variant.files && baseFiles.length > 0) {
      baseFiles[0].content = variant.text;
    }
    mergedContent = {
      ...b.content,
      text: "",
      html: "",
      files: baseFiles.length > 0 ? baseFiles : variant.files,
      imageUrl: "",
      caption: "",
      audioUrl: "",
      transcript: "",
      embedUrl: "",
      embedTitle: "",
      mermaidCode: "",
      labels: [],
      series: [],
      nodes: [],
      edges: [],
      source: "",
      url: "",
      quote: "",
      page: "",
      ...variant,
    } as typeof b.content;
  }

  const rb: RBlock = {
    id: b.uid,
    type: ([
      "paragraph",
      "heading",
      "quote",
      "callout",
      "code",
      "citation",
      "question",
      "image",
      "chart",
      "mermaid",
      "flowchart",
      "exercise",
      "audio_note",
      "embed",
    ].includes(b.kind)
      ? b.kind
      : "paragraph") as RBlock["type"],
    content: mergedContent as any as Record<string, unknown>,
    mode_visibility: b.modeVisibility,
    monetization_eligible: b.monetizationEligible,
    semantic_role: b.semanticRole,
    position: i,
  }

  return (
    <div className="group relative w-full">
      {validModes.length > 1 && previewMode === null && (
        <>
          <button onClick={() => switchMode(-1)} className="absolute left-[-2rem] top-1/2 -translate-y-1/2 md:opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-all z-10" title="Previous variant">
            <ChevronLeft className="size-4" />
          </button>
          <div className="absolute top-0 right-0 text-[9px] font-bold uppercase tracking-widest text-primary/70 xs:opacity-0 group-hover:opacity-100 transition-all px-1.5 py-0.5 rounded z-10 -translate-y-full">
            {actualMode} mode
          </div>
          <button onClick={() => switchMode(1)} className="absolute right-[-2rem] top-1/2 -translate-y-1/2 md:opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-all z-10" title="Next variant">
            <ChevronRight className="size-4" />
          </button>
        </>
      )}
      <BlockView block={rb} />
    </div>
  )
}

