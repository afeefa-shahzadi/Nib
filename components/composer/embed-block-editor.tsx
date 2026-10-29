 
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  embedUrl?: string
  embedTitle?: string
  onChange: (patch: { embedUrl?: string; embedTitle?: string }) => void
}

export function EmbedBlockEditor({ embedUrl, embedTitle, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/10 p-4">
      <div>
        <Label className="mb-1 block text-xs text-muted-foreground">
          Embed URL (YouTube, Loom, or any URL)
        </Label>
        <Input
          value={embedUrl ?? ""}
          onChange={(e) => onChange({ embedUrl: e.target.value })}
          placeholder="https://youtube.com/watch?v=…"
          className="h-8 bg-background text-sm"
        />
      </div>
      <div>
        <Label className="mb-1 block text-xs text-muted-foreground">
          Caption / Title
        </Label>
        <Input
          value={embedTitle ?? ""}
          onChange={(e) => onChange({ embedTitle: e.target.value })}
          placeholder="Caption (optional)"
          className="h-8 bg-background text-sm"
        />
      </div>
    </div>
  )
}
