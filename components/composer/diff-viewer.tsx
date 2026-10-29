import { useMemo } from "react"
import { diffLines, diffWordsWithSpace } from "diff"
import { cn } from "@/lib/utils"

interface DiffViewerProps {
  originalText: string
  newText: string
  type: "code" | "text"
}

export function DiffViewer({ originalText, newText, type }: DiffViewerProps) {
  const changes = useMemo(() => {
    if (originalText === newText) {
      return []
    }
    return type === "code"
      ? diffLines(originalText, newText)
      : diffWordsWithSpace(originalText, newText)
  }, [originalText, newText, type])

  if (originalText === newText) {
    return (
      <div className="rounded border border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground italic">
        No differences detected. The AI generated the exact same text.
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded border border-border bg-card p-3 overflow-x-auto text-sm",
        type === "code" && "font-mono"
      )}
    >
      <pre className="whitespace-pre-wrap wrap-break-word">
        {changes.map((part, i) => (
          <span
            key={i}
            className={cn(
              part.added && "bg-success/20 text-success dark:bg-success/30 font-medium px-0.5",
              part.removed && "bg-destructive/20 text-destructive dark:bg-destructive/30 line-through opacity-70 px-0.5"
            )}
          >
            {part.value}
          </span>
        ))}
      </pre>
    </div>
  )
}
