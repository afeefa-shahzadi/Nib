import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { createHighlight, createAnnotation } from "@/actions/highlights"
import { toast } from "sonner"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  pieceId: string
  selectedText: string
  onAnnotationSaved: () => void
}

export function AnnotationDialog({ open, onOpenChange, pieceId, selectedText, onAnnotationSaved }: Props) {
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!note.trim()) {
      toast.error("Please add a note")
      return
    }
    setSaving(true)
    try {
      // 1. Create the highlight
      const hRes = await createHighlight(pieceId, selectedText)
      if (!hRes.success || !hRes.highlightId) {
        toast.error(hRes.error || "Failed to create highlight")
        return
      }
      
      // 2. Add the annotation
      const aRes = await createAnnotation(hRes.highlightId, note)
      if (aRes.success) {
        toast.success("Annotation saved")
        setNote("")
        onOpenChange(false)
        onAnnotationSaved()
      } else {
        toast.error(aRes.error || "Failed to save annotation")
      }
    } catch {
      toast.error("An error occurred")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Annotation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/50 p-3">
            <p className="text-sm italic text-muted-foreground border-l-2 border-primary pl-2">
              &quot;{selectedText}&quot;
            </p>
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Your thoughts..."
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !note.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
