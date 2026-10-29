"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"

export interface CitationDraft {
  source: string
  url: string
  page: string
  quote: string
}

export function CitationPicker({
  initial,
  onClose,
  onConfirm,
}: {
  initial: CitationDraft
  onClose: () => void
  onConfirm: (p: CitationDraft) => void
}) {
  const [draft, setDraft] = useState<CitationDraft>(initial)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!draft.source && !draft.url && !draft.quote) {
      return setError("Add at least a source, URL, or quote")
    }
    let url = (draft.url || "").trim()
    if (url && !/^https?:/i.test(url)) url = `https://${url}`
    if (url) {
      try {
        new URL(url)
      } catch {
        return setError("Invalid URL")
      }
    }
    onConfirm({
      source: (draft.source || "").trim(),
      url,
      page: (draft.page || "").trim(),
      quote: (draft.quote || "").trim(),
    })
  }

  return (
    <CitationDialog
      onClose={onClose}
      draft={draft}
      setDraft={(d) => {
        setDraft(d)
        setError(null)
      }}
      error={error}
      onSubmit={submit}
    />
  )
}

function CitationDialog({
  draft,
  setDraft,
  error,
  onClose,
  onSubmit,
}: {
  draft: CitationDraft
  setDraft: (d: CitationDraft) => void
  error: string | null
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Citation details</DialogTitle>
          <DialogDescription className="sr-only">Enter the details of the citation.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Source</Label>
            <Input
              autoFocus
              value={draft.source}
              onChange={(e) => setDraft({ ...draft, source: e.target.value })}
              placeholder="Author, publication, or work"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">URL</Label>
            <Input
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Page / locator</Label>
            <Input
              value={draft.page}
              onChange={(e) => setDraft({ ...draft, page: e.target.value })}
              placeholder="e.g. p. 42, chapter 3"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Pulled quote</Label>
            <Textarea
              value={draft.quote}
              onChange={(e) => setDraft({ ...draft, quote: e.target.value })}
              placeholder="The passage you're citing…"
              rows={3}
            />
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>Save citation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
