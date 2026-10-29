"use client"
import { useEffect, useState } from "react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface Props {
  open: boolean
  initialUrl?: string
  initialLabel?: string
  onClose: () => void
  onConfirm: (args: { url: string; label: string }) => void
  onRemove?: () => void
  children?: React.ReactNode
}

export function CitationPickerPopover({
  open,
  initialUrl = "",
  initialLabel = "",
  onClose,
  onConfirm,
  onRemove,
  children,
}: Props) {
  const [url, setUrl] = useState(initialUrl)
  const [label, setLabel] = useState(initialLabel)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        setUrl(initialUrl)
        setLabel(initialLabel || "") // Auto-assigned by system, or existing
        setError(null)
      })
    }
  }, [open, initialUrl, initialLabel])

  const submit = () => {
    const trimmedUrl = url.trim()
    const trimmedLabel = label.trim()
    
    if (!trimmedUrl) return setError("URL is required")
      
    let normalized = trimmedUrl
    if (!/^(https?:|mailto:|\/|#)/i.test(trimmedUrl))
      normalized = `https://${trimmedUrl}`
    try {
      if (/^https?:/i.test(normalized)) new URL(normalized)
    } catch {
      return setError("Invalid URL")
    }
    onConfirm({ url: normalized, label: trimmedLabel })
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 shadow-xl" side="bottom" align="center" sideOffset={8}>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="citation-url" className="text-xs font-semibold">
              Source URL
            </Label>
            <Input
              id="citation-url"
              autoFocus
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit()
              }}
              placeholder="https://example.com/source"
              className="h-8 text-sm"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center justify-between pt-1">
            {onRemove && initialUrl ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive h-7 px-2 text-xs"
                onClick={onRemove}
              >
                Remove
              </Button>
            ) : <div />}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" className="h-7 px-3 text-xs" onClick={submit}>
                {initialUrl ? "Update" : "Insert"}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

