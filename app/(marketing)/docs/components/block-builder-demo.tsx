"use client"

import { useState } from "react"
import {
  MODES,
  BLOCK_BUILDER_KINDS,
  BLOCK_BUILDER_DEFAULTS,
} from "@/lib/content/docs/data"
import type { ModeId } from "@/lib/types/marketing"
import { DemoToolbar } from "./demo-toolbar"

export function BlockBuilderDemo() {
  const [kind, setKind] = useState<(typeof BLOCK_BUILDER_KINDS)[number]>(
    BLOCK_BUILDER_DEFAULTS.kind
  )
  const [text, setText] = useState(BLOCK_BUILDER_DEFAULTS.text)
  const [modes, setModes] = useState<Record<ModeId, boolean>>(
    BLOCK_BUILDER_DEFAULTS.modes
  )
  const toggleMode = (m: ModeId) => setModes((s) => ({ ...s, [m]: !s[m] }))
  const reset = () => {
    setKind(BLOCK_BUILDER_DEFAULTS.kind)
    setText(BLOCK_BUILDER_DEFAULTS.text)
    setModes(BLOCK_BUILDER_DEFAULTS.modes)
  }

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <DemoToolbar label="Block builder" onReset={reset} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="surface space-y-4 rounded-xl border border-border/60 p-5">
          <div>
            <label
              htmlFor="bb-kind"
              className="text-xs tracking-wider text-muted-foreground uppercase"
            >
              Block type
            </label>
            <div id="bb-kind" className="mt-2 flex flex-wrap gap-1.5">
              {BLOCK_BUILDER_KINDS.map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  className={`rounded border px-2.5 py-1 text-xs transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none ${
                    kind === k
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label
              htmlFor="bb-text"
              className="text-xs tracking-wider text-muted-foreground uppercase"
            >
              Content
            </label>
            <textarea
              id="bb-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-md border border-border bg-background p-3 text-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            />
            {!text.trim() && (
              <p className="mt-1 text-xs text-note" role="status">
                Empty content — the block will render as a placeholder.
              </p>
            )}
          </div>
          <div>
            <span className="text-xs tracking-wider text-muted-foreground uppercase">
              Visible in modes
            </span>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => toggleMode(m.id)}
                  aria-pressed={modes[m.id]}
                  className={`rounded border px-2 py-1.5 text-xs transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none ${
                    modes[m.id]
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="surface-elevated rounded-xl border border-border/60 p-5">
          <p className="mb-3 text-xs tracking-wider text-primary uppercase">
            Live preview
          </p>
          <div className="space-y-3">
            {MODES.map((m) => (
              <div
                key={m.id}
                className={`rounded-md border p-3 ${
                  modes[m.id]
                    ? "border-border bg-background/40"
                    : "border-dashed border-border"
                }`}
              >
                <p className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
                  {m.name}
                </p>
                {modes[m.id] ? (
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 rounded bg-primary/15 px-2 py-0.5 text-[10px] tracking-wider text-primary uppercase">
                      {kind}
                    </span>
                    <p className="text-sm text-foreground/90">
                      {text || (
                        <em className="text-muted-foreground">Empty block</em>
                      )}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    — hidden in this mode —
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
