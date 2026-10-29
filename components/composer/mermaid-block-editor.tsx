import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"

interface Props {
  mermaidCode: string
  caption?: string
  onChange: (patch: { mermaidCode?: string; caption?: string }) => void
}

export function MermaidBlockEditor({ mermaidCode, caption, onChange }: Props) {
  return (
    <div className="space-y-3">
      <Textarea
        value={mermaidCode}
        onChange={(e) => onChange({ mermaidCode: e.target.value })}
        placeholder="Enter Mermaid syntax here... (e.g., graph TD; A-->B;)"
        className="min-h-50 resize-y font-mono text-xs"
        rows={10}
      />
      <Input
        value={caption ?? ""}
        onChange={(e) => onChange({ caption: e.target.value })}
        placeholder="Caption (optional)"
        className="h-7 text-xs"
      />
    </div>
  )
}
