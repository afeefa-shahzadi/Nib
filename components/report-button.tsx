"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Flag } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { reportContent } from "@/actions/reports"

type Props = {
  pieceId: string
  authed: boolean
  className?: string
  /** Report something other than the piece itself (e.g. a comment). pieceId stays the containing piece. */
  targetType?: "comment" | "profile"
  targetId?: string
  /** Controlled: the caller renders its own trigger (e.g. a menu item) and no button is rendered here. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const BTN =
  "text-xs px-1.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

export function ReportButton({ pieceId, authed, className, targetType, targetId, open, onOpenChange }: Props) {
  const noun = targetType === "comment" ? "response" : targetType === "profile" ? "profile" : "piece"
  const router = useRouter()
  const [ownOpen, setOwnOpen] = useState(false)
  const [reportType, setReportType] = useState("")
  const [reportReason, setReportReason] = useState("")
  const reportOpen = open ?? ownOpen
  const setReportOpen = (v: boolean) => {
    if (!v) {
      setReportType("")
      setReportReason("")
    }
    ;(onOpenChange ?? setOwnOpen)(v)
  }
  const [reporting, setReporting] = useState(false)

  const requireAuth = () => {
    if (!authed) {
      router.push("/login")
      return false
    }
    return true
  }

  const openReport = () => {
    if (!requireAuth()) return
    setReportOpen(true)
  }

  const doReport = async () => {
    if (!reportType) {
      toast.error("Please select a reason")
      return
    }
    const finalReason = reportType === "other" || reportType === "spam" ? `${reportType}: ${reportReason}` : reportType;

    setReporting(true)
    try {
      const res = await reportContent(
        pieceId,
        finalReason.trim(),
        targetType && targetId ? { type: targetType, id: targetId } : undefined
      )
      if (res.success) {
        toast.success("Thanks. We'll review it.")
        setReportOpen(false)
      } else {
        toast.error(res.error || "Failed to submit report")
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setReporting(false)
    }
  }

  return (
    <>
      {open === undefined && <button onClick={openReport} aria-label={`Report this ${noun}`} title={`Report this ${noun}`} className={cn(BTN, className)}>
        <Flag className="size-3.5" /> Report
      </button>}

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this {noun}</DialogTitle>
            <DialogDescription>
              Tell us what's wrong. We review every report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spam">Spam or misleading</SelectItem>
                  <SelectItem value="harassment">Harassment or bullying</SelectItem>
                  <SelectItem value="hate_speech">Hate speech or symbols</SelectItem>
                  <SelectItem value="violence">Violence or threat of violence</SelectItem>
                  <SelectItem value="nsfw_unflagged">NSFW not flagged</SelectItem>
                  <SelectItem value="csam">CSAM / sexualizes minors</SelectItem>
                  <SelectItem value="medical_misinformation">Medical misinformation</SelectItem>
                  <SelectItem value="illegal">Illegal content</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(reportType === "other" || reportType === "spam") && (
              <div className="space-y-2 animate-in fade-in zoom-in duration-200">
                <Label htmlFor="reportReason">Additional Details (Optional)</Label>
                <Textarea
                  id="reportReason"
                  rows={3}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Please provide more information..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportOpen(false)} disabled={reporting}>
              Cancel
            </Button>
            <Button onClick={doReport} disabled={reporting || !reportType} variant="destructive">
              {reporting ? "Submitting…" : "Send report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
