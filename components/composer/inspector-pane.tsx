import { Sparkles, Lock, Tag, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  MODES,
  MODE_LABEL,
  KIND_META,
  type BlockDraft,
  type ReadingMode,
} from "./types"

interface Props {
  block: BlockDraft | null
  onUpdate: (patch: Partial<BlockDraft>) => void
  onGenerateVariant: (mode: ReadingMode) => void
  aiBusy: boolean
  onApplyVariant: (mode: ReadingMode) => void
}

// Fix #10: sourced from canonical BlockKind to prevent out-of-sync values like "context"/"method"
// that don't exist in the type system and won't round-trip from the DB correctly.
const SEMANTIC_ROLES: (string | null)[] = [
  null,
  "thesis",
  "evidence",
  "counter",
  "footnote",
]

export function InspectorPane({
  block,
  onUpdate,
  onGenerateVariant,
  aiBusy,
  onApplyVariant,
}: Props) {
  if (!block) {
    return (
      <div className="p-5 text-xs text-muted-foreground">
        <p className="mb-2 text-[10px] tracking-[0.2em] uppercase">Inspector</p>
        Click a block to inspect its mode visibility, role, and AI variants.
      </div>
    )
  }
  const meta = KIND_META[block.kind]
  const variants = block.content.aiVariants ?? {}

  return (
    <div className="space-y-5 p-5 text-sm">
      <div>
        <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          Block
        </p>
        <p className="mt-0.5 flex items-center gap-2 font-display text-lg">
          <span className="inline-flex size-6 items-center justify-center rounded bg-muted text-xs">
            {meta.icon}
          </span>
          {meta.label}
        </p>
        <p className="text-xs text-muted-foreground">{meta.hint}</p>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1 text-xs font-medium">
          <Eye className="size-3" /> Mode visibility
        </p>
        <div className="grid grid-cols-1 gap-1">
          {MODES.map((m) => (
            <label
              key={m}
              className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-accent/50"
            >
              <span className="text-xs">{MODE_LABEL[m]}</span>
              <Checkbox
                checked={block.modeVisibility[m]}
                onCheckedChange={(checked) =>
                  onUpdate({
                    modeVisibility: {
                      ...block.modeVisibility,
                      [m]: checked === true,
                    },
                  })
                }
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1 text-xs font-medium">
          <Tag className="size-3" /> Semantic role
        </p>
        <Select
          value={block.semanticRole ?? "__none__"}
          onValueChange={(v) =>
            onUpdate({ semanticRole: v === "__none__" ? null : v })
          }
        >
          <SelectTrigger aria-label="Semantic role" className="h-8 w-full rounded border border-border bg-background px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEMANTIC_ROLES.map((r) => (
              <SelectItem key={r ?? "__none__"} value={r ?? "__none__"}>
                {r ?? "— none —"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1.5">
          <span className="flex items-center gap-1.5 text-xs">
            <Lock className="size-3" /> Supporters only
          </span>
          <Checkbox
                checked={block.monetizationEligible}
                onCheckedChange={(checked) =>
                  onUpdate({ monetizationEligible: checked === true })
            }
          />
        </label>
      </div>
      <div>
        <label className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1.5 mt-2">
          <span className="flex items-center gap-1.5 text-xs text-destructive">
            <Eye className="size-3" /> Flag as NSFW
          </span>
          <Checkbox
                checked={block.isNsfw || false}
                onCheckedChange={(checked) =>
                  onUpdate({ isNsfw: checked === true })
            }
          />
        </label>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1 text-xs font-medium">
          <Sparkles className="size-3" /> AI variants
        </p>
        <div className="space-y-1">
          {MODES.map((m) => {
            const v = variants[m]
            return (
              <div key={m} className="rounded border border-border p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{MODE_LABEL[m]}</span>
                  <div className="flex items-center gap-1">
                    {v && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px]"
                        onClick={() => onApplyVariant(m)}
                      >
                        Review
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px]"
                      disabled={aiBusy}
                      onClick={() => onGenerateVariant(m)}
                    >
                      {v ? "Regenerate" : "Generate"}
                    </Button>
                  </div>
                </div>
                {v && (
                  <p className="mt-1 line-clamp-3 text-[11px] text-muted-foreground">
                    {v.text}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
