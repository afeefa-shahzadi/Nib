"use client"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"
import { Clock } from "lucide-react"

interface ScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  status: string
  scheduledFor: string | null | undefined
  onSchedule: (when: Date) => Promise<boolean>
  onClear: () => Promise<boolean>
}

export function ScheduleDialog({
  open,
  onOpenChange,
  status,
  scheduledFor,
  onSchedule,
  onClear,
}: ScheduleDialogProps) {
  const [date, setDate] = useState<Date | undefined>(() => 
    scheduledFor ? new Date(scheduledFor) : undefined
  )
  const [time, setTime] = useState<string>(() => {
    if (scheduledFor) {
      const d = new Date(scheduledFor)
      const pad = (n: number) => String(n).padStart(2, "0")
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    const now = new Date()
    const nextHour = now.getHours() + 1
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${pad(nextHour % 24)}:00`
  })
  const [isEditing, setIsEditing] = useState(!scheduledFor)
  const [prevOpen, setPrevOpen] = useState(open)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setIsEditing(!scheduledFor)
      if (scheduledFor) {
        const d = new Date(scheduledFor)
        setDate(d)
        const pad = (n: number) => String(n).padStart(2, "0")
        setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)
      } else {
        setDate(undefined)
        const now = new Date()
        const nextHour = now.getHours() + 1
        const pad = (n: number) => String(n).padStart(2, "0")
        setTime(`${pad(nextHour % 24)}:00`)
      }
    }
  }

  const handleClear = async () => {
    try {
      // onClear resolves false when the write failed (it already surfaced the
      // error toast); only claim success when it actually saved.
      const ok = await onClear()
      if (!ok) return
      toast.success("Schedule cleared")
      onOpenChange(false)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleSchedule = async () => {
    if (!date) {
      toast.error("Pick a date")
      return
    }
    const [hours, minutes] = time.split(":").map(Number)
    const when = new Date(date)
    when.setHours(hours || 0, minutes || 0, 0, 0)

    if (when.getTime() <= Date.now()) {
      toast.error("Pick a future date and time")
      return
    }
    try {
      const ok = await onSchedule(when)
      if (!ok) return
      toast.success(`Scheduled for ${format(when, "PPp")}`)
      onOpenChange(false)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const now = new Date()
  const isToday = date && date.toDateString() === now.toDateString()
  const minTime = isToday ? `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}` : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>Schedule publication</DialogTitle>
          <DialogDescription>
            Pick a future date — the piece moves to &quot;scheduled&quot; and
            publishes automatically.
          </DialogDescription>
        </DialogHeader>
        {status === "scheduled" && !isEditing ? (
          <div className="grid gap-4 py-8 place-items-center text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Scheduled for</p>
                <p className="text-lg font-bold">
                  {scheduledFor ? format(new Date(scheduledFor), "PPP 'at' p") : ""}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground w-full mt-4">
              Current status: <span className="font-mono">{status}</span>
            </p>
          </div>
        ) : (
          <div className="grid gap-4 py-4 place-items-center">
            <div className="rounded-md border shadow-sm">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                captionLayout="dropdown"
                startMonth={new Date()}
                endMonth={new Date(new Date().getFullYear() + 5, 11)}
                className="p-3"
              />
              <div className="border-t p-3 flex items-center justify-between gap-2 bg-muted/30">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Time
                </span>
                <Input
                  type="time"
                  value={time}
                  min={minTime}
                  onChange={(e) => {
                    setTime(e.target.value)
                    // Let the native input handle block initially, but validate
                    if (minTime && e.target.value < minTime) {
                      toast.error("Pick a future time")
                      setTime(minTime)
                    }
                  }}
                  className="w-fit appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground w-full">
              Current status: <span className="font-mono">{status}</span>
            </p>
          </div>
        )}
        <DialogFooter className="sm:justify-between w-full">
          {status === "scheduled" && !isEditing ? (
            <>
              <Button variant="outline" onClick={handleClear} className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive">
                Clear schedule
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button onClick={() => setIsEditing(true)}>Edit schedule</Button>
              </div>
            </>
          ) : status === "scheduled" && isEditing ? (
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSchedule}>Update schedule</Button>
            </div>
          ) : (
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleSchedule}>Schedule</Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
