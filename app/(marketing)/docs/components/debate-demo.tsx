"use client"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DEBATE_INITIAL_RESPONSES } from "@/lib/content/docs/data"
import { DemoToolbar } from "./demo-toolbar"

export function DebateDemo() {
  const [responses, setResponses] = useState(DEBATE_INITIAL_RESPONSES)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const submit = () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      setError("Write something before posting.")
      return
    }
    if (trimmed.length < 8) {
      setError("Make your response at least 8 characters.")
      return
    }
    setResponses((r) => [
      ...r,
      { id: Date.now(), author: "You", text: trimmed },
    ])
    setDraft("")
    setError(null)
    toast.success("Response posted")
  }
  return (
    <div className="surface overflow-hidden rounded-xl border border-border/60">
      <div className="hairline-b flex items-start justify-between gap-3 p-5">
        <div>
          <p className="mb-1 text-sm font-medium text-primary">
            Debate room prompt
          </p>
          <p className="font-display text-lg">
            &quot;Mode-switching fragments authorial voice.&quot;
          </p>
        </div>
        <DemoToolbar
          label="Debate"
          onReset={() => {
            setResponses(DEBATE_INITIAL_RESPONSES)
            setDraft("")
            setError(null)
          }}
        />
      </div>
      <ul className="divide-y divide-border/60" aria-label="Responses">
        {[...responses].map((r) => (
          <li key={r.id} className="flex gap-4 p-5">
            <div className="flex-1">
              <p className="mb-1 text-xs text-muted-foreground">{r.author}</p>
              <p className="text-sm leading-relaxed text-foreground/90">
                {r.text}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <div className="hairline-t p-5">
        <div className="flex gap-2">
          <label htmlFor="debate-draft" className="sr-only">
            Your response
          </label>
          <Input
            id="debate-draft"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setError(null)
            }}
            placeholder="Add your response…"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            aria-invalid={!!error}
            aria-describedby={error ? "debate-error" : undefined}
          />
          <Button onClick={submit}>Post</Button>
        </div>
        {error && (
          <p
            id="debate-error"
            role="alert"
            className="mt-2 text-xs text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
