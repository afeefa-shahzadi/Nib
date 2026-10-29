"use client"
import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { MODES, DEMO_PIECE } from "@/lib/content/docs/data"
import type { Block } from "@/components/block-renderer"
import { CalloutBlock, CitationBlock, ParagraphBlock } from "@/components/reader/text-blocks"

// Render demo blocks with the reader's own components, so the demo looks like a real piece.
function DemoBlockView({ b }: { b: (typeof DEMO_PIECE)[number] }) {
  if (b.kind === "callout") return <CalloutBlock block={{ type: "callout", content: { text: b.text } } as Block} />
  if (b.kind === "citation") return <CitationBlock block={{ type: "citation", content: { text: b.text } } as Block} />
  const role = b.kind === "para" ? null : b.kind
  return <ParagraphBlock block={{ type: "paragraph", content: { text: b.text }, semantic_role: role } as Block} />
}
import type { ModeId } from "@/lib/types/marketing"
import { DemoToolbar } from "./demo-toolbar"

export function ModeDemo() {
  const initial: { mode: ModeId; showHidden: boolean } = {
    mode: "standard",
    showHidden: false,
  }
  const [mode, setMode] = useState<ModeId>(initial.mode)
  const [showHidden, setShowHidden] = useState(initial.showHidden)
  const current = MODES.find((m) => m.id === mode)!
  const visible = DEMO_PIECE.filter((b) => b.modes.includes(mode))

  return (
    <div className="surface-elevated overflow-hidden rounded-xl border border-border/60">
      <div className="hairline-b flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div
          role="tablist"
          aria-label="Reading mode"
          className="flex flex-wrap gap-1"
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={`min-h-11 rounded-md px-3 py-1.5 text-sm lg:min-h-8 transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none ${
                mode === m.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted-foreground lg:min-h-8">
            <Checkbox checked={showHidden} onCheckedChange={(v) => setShowHidden(v === true)} />
            Show hidden blocks
          </label>
          <DemoToolbar
            label="Mode demo"
            onReset={() => {
              setMode(initial.mode)
              setShowHidden(initial.showHidden)
            }}
          />
        </div>
      </div>
      <div className="p-6 md:p-8">
        <p className="mb-1 text-sm font-medium text-foreground">
          {current.name} mode
        </p>
        <p className="mb-6 text-sm text-muted-foreground" aria-live="polite">
          {current.hint} · {visible.length} of {DEMO_PIECE.length} blocks
          visible.
        </p>
        <div className="font-reading text-[1.0625rem] leading-relaxed">
          {DEMO_PIECE.map((b) =>
            b.modes.includes(mode) ? (
              <DemoBlockView key={b.id} b={b} />
            ) : showHidden ? (
              <div key={b.id} className="opacity-35" aria-label="Hidden in this mode">
                <DemoBlockView b={b} />
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  )
}
