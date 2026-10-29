"use client"
import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface Props {
  open: boolean
  initialUrl?: string
  initialText?: string
  /** When true, text field is hidden (selection-based insertion). */
  hideText?: boolean
  onClose: () => void
  onConfirm: (args: { url: string; text?: string }) => void
  onRemove?: () => void
}

export function LinkPickerDialog({
  open,
  initialUrl = "",
  initialText = "",
  hideText,
  onClose,
  onConfirm,
  onRemove,
}: Props) {
  const [url, setUrl] = useState(initialUrl)
  const [text, setText] = useState(initialText)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        setUrl(initialUrl)
        setText(initialText)
        setError(null)
      })
    }
  }, [open, initialUrl, initialText])

  const submit = () => {
    const trimmed = url.trim()
    if (!trimmed) return setError("URL is required")
    let normalized = trimmed
    if (!/^(https?:|mailto:|\/|#)/i.test(trimmed))
      normalized = `https://${trimmed}`
    try {
      if (/^https?:/i.test(normalized)) new URL(normalized)
    } catch {
      return setError("Invalid URL")
    }
    onConfirm({ url: normalized, text: text.trim() || undefined })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent aria-describedby="link-picker-description">
        <DialogHeader>
          <DialogTitle>{initialUrl ? "Edit link" : "Insert link"}</DialogTitle>
          <DialogDescription id="link-picker-description" className="sr-only">
            Enter the link details.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="link-url" className="text-xs">
              URL
            </Label>
            <Input
              id="link-url"
              autoFocus
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit()
              }}
              placeholder="https://example.com"
            />
          </div>
          {!hideText && (
            <div className="space-y-1">
              <Label htmlFor="link-text" className="text-xs">
                Display text (optional)
              </Label>
              <Input
                id="link-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit()
                }}
                placeholder="Click to read more"
              />
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          {onRemove && initialUrl && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={onRemove}
            >
              Remove link
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{initialUrl ? "Update" : "Insert"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
