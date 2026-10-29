import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GitCommit } from "lucide-react"

interface Props {
  onCommit: (message: string) => Promise<void>
  disabled?: boolean
}

export function CommitDialog({ onCommit, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  const handleCommit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!message.trim()) return
    setBusy(true)
    try {
      await onCommit(message.trim())
      setOpen(false)
      setMessage("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full text-xs" disabled={disabled}>
          <GitCommit className="mr-2 size-3" /> Save version
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-106.25">
        <form onSubmit={handleCommit}>
          <DialogHeader>
            <DialogTitle>Save Version</DialogTitle>
            <DialogDescription>
              Create a named snapshot of your current draft to preserve its history.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="message">Commit message</Label>
              <Input
                id="message"
                placeholder="e.g. Added introduction, Fixed typos..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!message.trim() || busy}>
              {busy ? "Saving..." : "Save version"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
