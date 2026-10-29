"use client"

import { useState } from "react"
import { Eye, EyeOff, Lock } from "lucide-react"
import { MODES, BLOCK_BUILDER_KINDS, BLOCK_BUILDER_DEFAULTS } from "@/lib/content/docs/data"
import type { ModeId } from "@/lib/types/marketing"
import type { Block } from "@/components/block-renderer"
import { CalloutBlock, CitationBlock, ParagraphBlock, QuestionBlock, QuoteBlock } from "@/components/reader/text-blocks"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DemoToolbar } from "./demo-toolbar"

type Kind = (typeof BLOCK_BUILDER_KINDS)[number]
const LABEL: Record<Kind, string> = {
  paragraph: "Paragraph",
  thesis: "Thesis",
  evidence: "Evidence",
  counter: "Counter",
  footnote: "Footnote",
  quote: "Quote",
  citation: "Citation",
  callout: "Callout",
  question: "Question",
  gated: "Gated",
}

// Preview with the reader's own block components, so it matches a published piece.
function Preview({ kind, text }: { kind: Kind; text: string }) {
  const content = { text: text || " " }
  if (kind === "quote") return <QuoteBlock block={{ type: "quote", content } as Block} />
  if (kind === "citation") return <CitationBlock block={{ type: "citation", content } as Block} />
  if (kind === "callout") return <CalloutBlock block={{ type: "callout", content } as Block} />
  if (kind === "question") return <QuestionBlock block={{ type: "question", content } as Block} />
  if (kind === "gated")
    return (
      <div className="relative">
        <div className="pointer-events-none blur-xs opacity-40 select-none">
          <ParagraphBlock block={{ type: "paragraph", content } as Block} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium">
          <Lock className="size-4 text-muted-foreground" aria-hidden /> Premium content
        </div>
      </div>
    )
  const role = kind === "paragraph" ? null : kind
  return <ParagraphBlock block={{ type: "paragraph", content, semantic_role: role } as Block} />
}

export function BlockBuilderDemo() {
  const [kind, setKind] = useState<Kind>(BLOCK_BUILDER_DEFAULTS.kind)
  const [text, setText] = useState(BLOCK_BUILDER_DEFAULTS.text)
  const [modes, setModes] = useState<Record<ModeId, boolean>>(BLOCK_BUILDER_DEFAULTS.modes)
  const reset = () => {
    setKind(BLOCK_BUILDER_DEFAULTS.kind)
    setText(BLOCK_BUILDER_DEFAULTS.text)
    setModes(BLOCK_BUILDER_DEFAULTS.modes)
  }
  const item = "h-11 rounded-md border px-3 text-sm data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary lg:h-8"

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <DemoToolbar label="Block builder" onReset={reset} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface space-y-5 rounded-xl border border-border/60 p-4 sm:p-6">
          <div className="space-y-2">
            <Label id="bb-kind">Block type</Label>
            <ToggleGroup
              type="single"
              aria-labelledby="bb-kind"
              value={kind}
              onValueChange={(v) => v && setKind(v as Kind)}
              className="flex flex-wrap justify-start gap-2"
            >
              {BLOCK_BUILDER_KINDS.map((k) => (
                <ToggleGroupItem key={k} value={k} className={item}>
                  {LABEL[k]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bb-text">Content</Label>
            <Textarea id="bb-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label id="bb-modes">Shown in</Label>
            <ToggleGroup
              type="multiple"
              aria-labelledby="bb-modes"
              value={MODES.filter((m) => modes[m.id]).map((m) => m.id)}
              onValueChange={(v) => setModes(Object.fromEntries(MODES.map((m) => [m.id, v.includes(m.id)])) as Record<ModeId, boolean>)}
              className="flex flex-wrap justify-start gap-2"
            >
              {MODES.map((m) => (
                <ToggleGroupItem key={m.id} value={m.id} className={item}>
                  {m.name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
        <div className="surface-elevated rounded-xl border border-border/60 p-4 sm:p-6">
          <p className="mb-4 text-sm font-medium text-muted-foreground">How readers see it</p>
          <div className="font-reading text-[1.0625rem] leading-relaxed" aria-live="polite">
            <Preview kind={kind} text={text} />
          </div>
          <ul className="hairline-t mt-6 grid grid-cols-2 gap-x-4 gap-y-2 pt-4 text-sm sm:grid-cols-3">
            {MODES.map((m) => (
              <li key={m.id} className={`flex items-center gap-2 ${modes[m.id] ? "text-foreground" : "text-muted-foreground line-through"}`}>
                {modes[m.id] ? <Eye className="size-4 text-primary" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
                {m.name}
                <span className="sr-only">{modes[m.id] ? "shown" : "hidden"}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
