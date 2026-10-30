/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Quote as QuoteIcon,
  Wand2,
  EyeOff,
} from "lucide-react"
import { useState, memo, useEffect, useMemo } from "react"
import { RichBlockEditor } from "./rich-block-editor"
import { ImageBlockEditor } from "./image-block-editor"
import { CodeBlockEditor } from "./code-block-editor"
import { sanitize } from "@/components/block-renderer"
import { ChartBlockEditor } from "./chart-block-editor"
import { MermaidBlockEditor } from "./mermaid-block-editor"
import { EmbedBlockEditor } from "./embed-block-editor"
import { ExerciseBlockEditor } from "./exercise-block-editor"
import { AudioBlockEditor } from "./audio-block-editor"
import dynamic from "next/dynamic"

const FlowchartBlockEditor = dynamic(
  () =>
    import("./flowchart-block-editor").then((mod) => mod.FlowchartBlockEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 animate-pulse items-center justify-center rounded-md border border-border bg-muted/20 text-xs text-muted-foreground">
        Loading interactive flowchart...
      </div>
    ),
  }
)

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CitationPicker } from "./citation-picker"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  KIND_META,
  MODES,
  htmlToText,
  encodeBlock,
  type BlockDraft,
  type ReadingMode,
  type BlockKind,
} from "./types"
import { BlockView } from "@/components/block-renderer"
import { DiffViewer } from "./diff-viewer"

interface Props {
  block: BlockDraft
  index: number
  isActive: boolean
  /** Mode currently being previewed in the canvas; dims block if not visible. */
  previewMode: ReadingMode | null
  heatmapEnabled?: boolean
  diffMode?: ReadingMode | null
  focusMode?: { mode: ReadingMode; ts: number }
  onGenerateVariant?: (mode: ReadingMode) => void
  onAcceptDiff?: () => void
  onDiscardDiff?: () => void
  onFocus: () => void
  onUpdate: (patch: Partial<BlockDraft>) => void
  onUpdateContent: (patch: Partial<BlockDraft["content"]>) => void
  onAddBelow: () => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
  onSlashTrigger?: (rect: DOMRect, query: string) => void
  onSlashClose?: () => void
  // Fix #5: citation picker state lifted to CanvasArea
  citationPickerOpen?: boolean
  onCitationPickerOpen?: () => void
  onCitationPickerClose?: () => void
  ydoc?: any
  provider?: any
  currentUser?: any
}

// Fix #18: lookup map replaces 9-level nested ternary
const RICH_KIND_CLASS: Partial<Record<BlockKind, string>> = {
  callout: "border-l-2 border-primary pl-3",
  quote: "border-l-2 border-border pl-3 italic",
  thesis: "border-l-2 border-note pl-3",
  counter: "border-l-2 border-destructive pl-3",
  evidence: "border-l-2 border-success pl-3",
  footnote: "border-l-2 border-border pl-3 text-sm text-muted-foreground",
  gated: "rounded-r border-l-2 border-primary bg-primary/5 pl-3",
  question: "border-l-2 border-info pl-3",
}

const RICH_KINDS = new Set([
  "paragraph",
  "quote",
  "callout",
  "question",
  "thesis",
  "evidence",
  "counter",
  "footnote",
  "gated",
])

const getHeatmapStyle = (modeVisibility: Record<ReadingMode, boolean>) => {
  const activeModes = Object.entries(modeVisibility)
    .filter(([, v]) => v)
    .map(([k]) => k as ReadingMode)
  
  if (activeModes.length === 0) {
    return { backgroundColor: "color-mix(in oklab, var(--muted-foreground) 10%, transparent)" }
  }
  
  const modeColors: Record<ReadingMode, string> = {
    skim: "color-mix(in oklab, var(--note) 15%, transparent)",
    standard: "color-mix(in oklab, var(--primary) 15%, transparent)", // primary
    expert: "color-mix(in oklab, var(--success) 15%, transparent)",
    teach: "color-mix(in oklab, var(--info) 15%, transparent)",
    debate: "color-mix(in oklab, var(--destructive) 15%, transparent)",
  }

  if (activeModes.length === 1) {
    return { backgroundColor: modeColors[activeModes[0]] || modeColors.standard }
  }

  // Gradient for multiple modes
  const colors = activeModes.map(m => modeColors[m] || modeColors.standard)
  return { backgroundImage: `linear-gradient(135deg, ${colors.join(', ')})` }
}

export const BlockCard = memo(function BlockCard({
  block,
  index,
  isActive,
  previewMode,
  heatmapEnabled,
  diffMode,
  focusMode,
  onGenerateVariant,
  onAcceptDiff,
  onDiscardDiff,
  onFocus,
  onUpdate,
  onUpdateContent,
  onAddBelow,
  onMove,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onSlashTrigger,
  onSlashClose,
  citationPickerOpen = false,
  onCitationPickerOpen,
  onCitationPickerClose,
  ydoc,
  provider,
  currentUser,
}: Props) {
  const meta = KIND_META[block.kind]
  const dimmed = previewMode && !block.modeVisibility[previewMode]
  const [isLocalPreview, setIsLocalPreview] = useState(false)
  const [localMode, setLocalMode] = useState<ReadingMode>(previewMode || "standard")

  useEffect(() => {
    setLocalMode(previewMode || "standard")
  }, [previewMode])

  useEffect(() => {
    if (diffMode) {
      setLocalMode(diffMode)
    }
  }, [diffMode])

  useEffect(() => {
    if (focusMode) {
      setLocalMode(focusMode.mode)
    }
  }, [focusMode])

  const switchMode = (dir: -1 | 1) => {
    const idx = MODES.indexOf(localMode)
    const newIdx = (idx + dir + MODES.length) % MODES.length
    setLocalMode(MODES[newIdx])
  }

  const isVariantMode = localMode !== "standard"
  const activeContent = useMemo(() => {
    if (!isVariantMode) return block.content
    const variant = block.content.aiVariants?.[localMode] || {}
    const baseFiles = block.content.files?.map(f => ({ ...f, content: "" })) || []
    
    if (variant.text && !variant.files && baseFiles.length > 0) {
      baseFiles[0].content = variant.text
    }

    return {
      ...block.content,
      // Provide blank fallbacks so variants start empty rather than inheriting standard content
      text: "",
      html: "",
      files: baseFiles,
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
      // Override with whatever the variant actually has defined so far
      ...variant,
    }
  }, [isVariantMode, block.content, localMode])

  const handleUpdateContent = (patch: Partial<BlockDraft["content"]>) => {
    if (isVariantMode) {
      onUpdateContent({
        aiVariants: {
          ...block.content.aiVariants,
          [localMode]: { ...block.content.aiVariants?.[localMode], ...patch },
        },
      })
    } else {
      onUpdateContent(patch)
    }
  }


  return (
    <div
      data-block-uid={block.uid}
      onClick={onFocus}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group relative rounded-md transition-all ${
        isActive ? "bg-card ring-1 ring-primary/40" : "hover:bg-accent/20"
      } ${dimmed ? "opacity-40 grayscale" : ""}`}
      style={heatmapEnabled && !dimmed ? getHeatmapStyle(block.modeVisibility) : undefined}
    >
      {dimmed && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm border border-border">
            <EyeOff className="size-3.5" />
            Hidden in {previewMode}
          </div>
        </div>
      )}

      {/* Left rail: handle + plus */}
      <div className="absolute top-1 -left-10 hidden flex-col gap-0.5 opacity-70 group-hover:flex">
        <button
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          title="Drag to reorder"
          className="inline-flex size-6 cursor-grab items-center justify-center rounded hover:bg-accent active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onAddBelow()
          }}
          title="Add block below"
          className="inline-flex size-6 items-center justify-center rounded hover:bg-accent"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {/* Header chip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2 text-[11px] text-muted-foreground">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="-m-1 flex items-center gap-1.5 rounded p-1 transition-colors hover:bg-accent/50"
                title="Change block type"
              >
                <span className="inline-flex size-4 items-center justify-center rounded bg-muted text-[10px]">
                  {meta.icon}
                </span>
                {meta.label}
                <ChevronDown className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-64 w-48 overflow-y-auto"
            >
              {Object.entries(KIND_META).map(([k, m]) => (
                <DropdownMenuItem
                  key={k}
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdate({ kind: k as BlockKind })
                  }}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="inline-flex size-4 items-center justify-center rounded bg-muted text-[10px]">
                    {m.icon}
                  </span>
                  {m.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {block.semanticRole && block.semanticRole !== block.kind && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
              {block.semanticRole}
            </span>
          )}
          {block.monetizationEligible && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
              gated
            </span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsLocalPreview(!isLocalPreview)
            }}
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${isLocalPreview ? "bg-primary/20 text-primary hover:bg-primary/30" : "bg-transparent text-muted-foreground hover:bg-accent/50"}`}
          >
            {isLocalPreview ? "Edit" : "Preview"}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation()
              onUpdate({ isNsfw: !block.isNsfw })
            }}
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${block.isNsfw ? "bg-destructive/20 text-destructive hover:bg-destructive/30" : "bg-transparent text-muted-foreground hover:bg-accent/50"}`}
            title="Mark as explicit (18+ only)"
          >
            {block.isNsfw ? "18+" : "NSFW"}
          </button>
          {/* Mobile mode dots (after NSFW) */}
          <span
            className="mode-chrome mr-1 flex sm:hidden items-center gap-0.5"
            title="Mode visibility"
          >
            {MODES.map((m) => (
              <span
                key={m}
                title={m}
                className={`size-1.5 rounded-full ${
                  block.modeVisibility[m] ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1 ml-auto">
          {/* Desktop mode dots */}
          <span
            className="mode-chrome mr-1 hidden sm:flex items-center gap-0.5"
            title="Mode visibility"
          >
            {MODES.map((m) => (
              <span
                key={m}
                title={m}
                className={`size-1.5 rounded-full ${
                  block.modeVisibility[m] ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </span>

          <div className="mode-chrome flex items-center bg-muted/30 rounded border border-border/50">
            <button 
              onClick={(e) => { e.stopPropagation(); switchMode(-1); }}
              className="p-1 hover:bg-accent rounded-l text-muted-foreground hover:text-foreground transition-colors"
              title="Previous mode variant"
            >
              <ChevronLeft className="size-3" />
            </button>
            <span className="text-[10px] uppercase font-medium w-15 text-center tracking-wider text-muted-foreground select-none" title="Currently editing variant">
              {localMode}
            </span>
            <button 
              onClick={(e) => { e.stopPropagation(); switchMode(1); }}
              className="p-1 hover:bg-accent rounded-r text-muted-foreground hover:text-foreground transition-colors"
              title="Next mode variant"
            >
              <ChevronRight className="size-3" />
            </button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="mode-chrome inline-flex size-5 items-center justify-center rounded text-primary hover:bg-primary/10"
                title="Generate AI Variant"
                onClick={(e) => e.stopPropagation()}
              >
                <Wand2 className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              {MODES.filter((m) => m !== "standard").map((m) => (
                <DropdownMenuItem
                  key={m}
                  onClick={(e) => {
                    e.stopPropagation()
                    onGenerateVariant?.(m)
                  }}
                  className="text-xs"
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)} Mode
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={(e) => {
              e.stopPropagation()
              onMove(-1)
            }}
            className="inline-flex size-5 items-center justify-center rounded hover:bg-accent"
            title="Move up"
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onMove(1)
            }}
            className="inline-flex size-5 items-center justify-center rounded hover:bg-accent"
            title="Move down"
          >
            <ChevronDown className="size-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="inline-flex size-5 items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 pt-1 pb-3">
        {isLocalPreview ? (
          <div className="pointer-events-none rounded border border-border p-3 opacity-90">
            <BlockView block={encodeBlock(block) as Parameters<typeof BlockView>[0]["block"]} />
          </div>
        ) : diffMode ? (
          <div className="space-y-3">
            <div className="mt-4 flex flex-col gap-4">
              {["paragraph", "code", "heading", "quote"].includes(block.kind) ? (
                <div className="rounded border border-primary/20 bg-background/50 p-3 shadow-inner">
                  <p className="mb-2 text-[10px] tracking-widest text-primary uppercase">
                    AI Variant Diff ({diffMode})
                  </p>
                  <DiffViewer
                    originalText={block.content.text || ""}
                    newText={block.content.aiVariants?.[diffMode]?.text || ""}
                    type={block.kind === "code" ? "code" : "text"}
                  />
                </div>
              ) : (
                <>
                  <div className="rounded border border-border bg-muted/20 p-3 opacity-60">
                    <p className="mb-2 text-[10px] tracking-widest text-muted-foreground uppercase">
                      Original
                    </p>
                    <div className="pointer-events-none">
                      <BlockView block={encodeBlock(block) as Parameters<typeof BlockView>[0]["block"]} />
                    </div>
                  </div>
                  <div className="rounded border border-primary/30 bg-primary/5 p-3">
                    <p className="mb-2 text-[10px] tracking-widest text-primary uppercase">
                      AI Variant ({diffMode})
                    </p>
                    <div className="pointer-events-none">
                      <BlockView 
                        block={encodeBlock({
                          ...block,
                          content: { ...block.content, ...block.content.aiVariants?.[diffMode] }
                        }) as Parameters<typeof BlockView>[0]["block"]} 
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={onDiscardDiff}>
                Dismiss
              </Button>
              <Button size="sm" variant="outline" onClick={() => onGenerateVariant?.(diffMode)}>
                <Wand2 className="mr-1 size-3" /> Regenerate
              </Button>
              <Button size="sm" onClick={onAcceptDiff}>
                Apply
              </Button>
            </div>
          </div>
        ) : block.kind === "heading" ? (
          <div className="flex items-center gap-2">
            <div className="flex shrink-0 overflow-hidden rounded border border-border">
              {[2, 3].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleUpdateContent({ level: lvl })
                  }}
                  className={`px-2 py-1 text-[11px] font-medium ${
                    (Number(activeContent.level) || 2) === lvl
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                  title={`Heading ${lvl}`}
                >
                  H{lvl}
                </button>
              ))}
            </div>
            <Input
              value={activeContent.text}
              onChange={(e) =>
                handleUpdateContent({ text: e.target.value, html: "" })
              }
              placeholder="Heading…"
              className={`h-auto border-0 px-0 py-1 font-display shadow-none focus-visible:ring-0 ${
                (Number(activeContent.level) || 2) === 3 ? "text-lg" : "text-xl"
              }`}
            />
          </div>
        ) : block.kind === "code" ? (
          <CodeBlockEditor
            lang={activeContent.lang as string}
            text={activeContent.text as string}
            files={activeContent.files as import("./code-block-editor").CodeFile[]}
            onChange={(patch) => handleUpdateContent({ ...patch, html: "" })}
          />
        ) : block.kind === "image" ? (
          <ImageBlockEditor
            imageUrl={activeContent.imageUrl}
            alt={activeContent.alt}
            caption={activeContent.caption}
            credit={activeContent.credit}
            creditUrl={activeContent.creditUrl}
            onChange={(patch) => handleUpdateContent(patch)}
          />
        ) : block.kind === "citation" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <QuoteIcon className="size-3" /> Citation
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={(e) => {
                  e.stopPropagation()
                  onCitationPickerOpen?.()
                }}
              >
                {activeContent.source || activeContent.url
                  ? "Edit details"
                  : "Add details"}
              </Button>
            </div>
            {activeContent.quote || activeContent.source || activeContent.url ? (
              <blockquote className="border-l-2 border-border pl-3 text-sm italic">
                {activeContent.quote && <p>“{activeContent.quote}”</p>}
                {(activeContent.source || activeContent.url) && (
                  <footer className="mt-1 text-[11px] text-muted-foreground not-italic">
                    {/* source is stored as "" when blank (?? won't fall back),
                        and new URL() throws on legacy/AI-written junk — both took
                        down the canvas. Use || and a guarded parse. */}
                    —{" "}
                    {activeContent.source ||
                      (() => {
                        try {
                          return new URL(activeContent.url!).hostname
                        } catch {
                          return activeContent.url || ""
                        }
                      })()}
                    {activeContent.page && `, p. ${activeContent.page}`}
                  </footer>
                )}
              </blockquote>
            ) : (
              <p className="text-xs text-muted-foreground">
                No citation yet. Click &ldquo;Add details&rdquo; to insert a
                quote, source, URL, and page.
              </p>
            )}
            {citationPickerOpen && (
              <CitationPicker
                initial={{
                  source: activeContent.source ?? "",
                  url: activeContent.url ?? "",
                  page: activeContent.page ?? "",
                  quote: activeContent.quote ?? "",
                }}
                onClose={() => onCitationPickerClose?.()}
                onConfirm={(p) => {
                  handleUpdateContent({
                    source: p.source || "",
                    url: p.url || "",
                    page: p.page || "",
                    quote: p.quote || "",
                    text: p.quote || p.source || "",
                  })
                  onCitationPickerClose?.()
                }}
              />
            )}
          </div>
        ) : block.kind === "chart" ? (
          <ChartBlockEditor
            chartType={activeContent.chartType ?? "bar"}
            labels={activeContent.labels ?? []}
            series={activeContent.series ?? []}
            caption={activeContent.caption}
            onChange={(patch) => handleUpdateContent(patch)}
          />
        ) : block.kind === "mermaid" ? (
          <MermaidBlockEditor
            mermaidCode={activeContent.mermaidCode ?? ""}
            caption={activeContent.caption}
            onChange={(patch) => handleUpdateContent(patch)}
          />
        ) : block.kind === "flowchart" ? (
          <FlowchartBlockEditor
            // FlowchartBuilder seeds its node/edge state once on mount, so remount
            // it when the displayed variant changes — otherwise a variant switch
            // keeps showing (and editing into) the standard graph.
            key={`${block.uid}-${localMode}`}
            nodes={(activeContent.nodes as React.ComponentProps<typeof FlowchartBlockEditor>["nodes"]) ?? []}
            edges={(activeContent.edges as React.ComponentProps<typeof FlowchartBlockEditor>["edges"]) ?? []}
            caption={activeContent.caption}
            onChange={(patch) => handleUpdateContent(patch)}
          />
        ) : block.kind === "exercise" ? (
          <ExerciseBlockEditor
            block={{ ...block, content: activeContent as BlockDraft["content"] }}
            onUpdateContent={handleUpdateContent}
          />
        ) : block.kind === "audio_note" ? (
          <AudioBlockEditor
            audioUrl={activeContent.audioUrl}
            transcript={activeContent.transcript}
            caption={activeContent.caption}
            onChange={(patch) => handleUpdateContent(patch)}
          />
        ) : block.kind === "embed" ? (
          <EmbedBlockEditor
            embedUrl={activeContent.embedUrl}
            embedTitle={activeContent.embedTitle}
            onChange={(patch) => handleUpdateContent(patch)}
          />
        ) : RICH_KINDS.has(block.kind) ? (
          <div className={RICH_KIND_CLASS[block.kind] ?? ""}>
            {isActive ? (
              <RichBlockEditor
                value={activeContent.html || (activeContent.text ? `<p>${activeContent.text}</p>` : "")}
                onChange={(html) => {
                  handleUpdateContent({ html, text: htmlToText(html) })
                }}
                placeholder={isVariantMode ? `Write manual '${localMode}' variant...` : meta.label + "…"}
                onFocus={onFocus}
                onSlashTrigger={onSlashTrigger}
                onSlashClose={onSlashClose}
                ydoc={ydoc}
                provider={provider}
                currentUser={currentUser}
                blockUid={block.uid}
              />
            ) : (
              <div 
                className="prose prose-sm dark:prose-invert max-w-none text-foreground min-h-[1.75rem] cursor-text focus:outline-none"
                dangerouslySetInnerHTML={{ 
                  __html: sanitize(activeContent.html || (activeContent.text ? `<p>${activeContent.text}</p>` : "")) || `<p class="text-muted-foreground">${isVariantMode ? `Empty ${localMode} variant…` : meta.label + "…"}</p>`
                }}
                onClick={onFocus}
              />
            )}
          </div>
        ) : null}
      </div>

      {/* Number ribbon */}
      <span className="absolute top-3 -left-6 text-[10px] text-muted-foreground tabular-nums select-none">
        {String(index + 1).padStart(2, "0")}
      </span>
    </div>
  )
}, (prev, next) => {
  return (
    prev.block === next.block &&
    prev.index === next.index &&
    prev.isActive === next.isActive &&
    prev.previewMode === next.previewMode &&
    prev.heatmapEnabled === next.heatmapEnabled &&
    prev.diffMode === next.diffMode &&
    prev.focusMode === next.focusMode &&
    prev.citationPickerOpen === next.citationPickerOpen
  )
})
