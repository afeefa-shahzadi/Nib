"use client"
import { useState } from "react"
import { MODES, DEMO_PIECE, KIND_BADGE } from "@/lib/content/docs/data"
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
  const hidden = DEMO_PIECE.filter((b) => !b.modes.includes(mode))

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
              className={`rounded-md px-3 py-1.5 text-xs transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none ${
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
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
            />
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
        <p className="mb-1 text-xs tracking-wider text-primary uppercase">
          {current.name} mode
        </p>
        <p className="mb-6 text-sm text-muted-foreground" aria-live="polite">
          {current.hint} · {visible.length} of {DEMO_PIECE.length} blocks
          visible.
        </p>
        <div className="space-y-3">
          {visible.map((b) => (
            <div key={b.id} className="group flex items-start gap-3">
              <span
                className={`mt-1 shrink-0 rounded px-2 py-0.5 text-[10px] tracking-wider uppercase ${
                  KIND_BADGE[b.kind].tone
                }`}
              >
                {KIND_BADGE[b.kind].label}
              </span>
              <p className="leading-relaxed text-foreground/90">{b.text}</p>
            </div>
          ))}
          {showHidden &&
            hidden.map((b) => (
              <div key={b.id} className="flex items-start gap-3 opacity-40">
                <span
                  className={`mt-1 shrink-0 rounded px-2 py-0.5 text-[10px] tracking-wider uppercase ${
                    KIND_BADGE[b.kind].tone
                  }`}
                >
                  {KIND_BADGE[b.kind].label}
                </span>
                <p className="leading-relaxed text-foreground/70 line-through decoration-muted-foreground/40">
                  {b.text}
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
