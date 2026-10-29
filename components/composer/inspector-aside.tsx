"use client"
import { InspectorPane } from "./inspector-pane"
import { RetrievalAssistant } from "./retrieval-assistant"
import { SynthesisPane } from "./synthesis-pane"
import type { BlockDraft, ReadingMode } from "./types"

interface InspectorAsideProps {
  pieceId: string
  inspectorTab: "inspector" | "archive" | "synthesis"
  setInspectorTab: (tab: "inspector" | "archive" | "synthesis") => void
  setInspectorCollapsed: (collapsed: boolean) => void
  active: BlockDraft | null
  blocks: BlockDraft[]
  updateBlock: (uid: string, patch: Partial<BlockDraft>) => void
  generateVariant: (uid: string, mode: ReadingMode) => Promise<void>
  aiBlockBusy: boolean
  reviewVariant: (uid: string, mode: ReadingMode) => void
  insertReadyBlock: (nb: BlockDraft) => void
  scrollToBlock: (uid: string) => void
}

export function InspectorAside({
  pieceId,
  inspectorTab,
  setInspectorTab,
  setInspectorCollapsed,
  active,
  blocks,
  updateBlock,
  generateVariant,
  aiBlockBusy,
  reviewVariant,
  insertReadyBlock,
  scrollToBlock,
}: InspectorAsideProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="hairline-b flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setInspectorTab("inspector")}
            className={`rounded px-2 py-1 text-[10px] tracking-[0.15em] uppercase ${
              inspectorTab === "inspector"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Inspector
          </button>
          <button
            onClick={() => setInspectorTab("archive")}
            className={`rounded px-2 py-1 text-[10px] tracking-[0.15em] uppercase ${
              inspectorTab === "archive"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Archive
          </button>
          <button
            onClick={() => setInspectorTab("synthesis")}
            className={`rounded px-2 py-1 text-[10px] tracking-[0.15em] uppercase ${
              inspectorTab === "synthesis"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Synthesis
          </button>
        </div>
        <button
          onClick={() => setInspectorCollapsed(true)}
          className="flex items-center justify-center size-8 -mr-2 text-[10px] tracking-[0.15em] text-muted-foreground uppercase hover:text-foreground hover:bg-accent/50 rounded"
          title="Collapse panel"
        >
          »
        </button>
      </div>

      {inspectorTab === "inspector" ? (
        <div className="flex-1 overflow-y-auto">
          <InspectorPane
            block={active}
            onUpdate={(patch) => active && updateBlock(active.uid, patch)}
            onGenerateVariant={(m) => active && generateVariant(active.uid, m)}
            aiBusy={aiBlockBusy}
            onApplyVariant={(m) => active && reviewVariant(active.uid, m)}
          />
        </div>
      ) : inspectorTab === "archive" ? (
        <div className="min-h-0 flex-1">
          <RetrievalAssistant
            excludePieceId={pieceId}
            onInsert={insertReadyBlock}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <SynthesisPane
            pieceId={pieceId}
            blocks={blocks}
            scrollToBlock={scrollToBlock}
          />
        </div>
      )}
    </div>
  )
}
