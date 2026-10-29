"use client"
import { useId, useRef, useState, type ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { joinWaitlist } from "@/actions/waitlist"
import type { WaitlistItem } from "@/lib/waitlist"

export function WaitlistButton({
  item,
  source,
  label = "Join waitlist",
  signedIn,
  ...buttonProps
}: {
  item: WaitlistItem
  source: string
  label?: string
  signedIn: boolean
} & Pick<ComponentProps<typeof Button>, "variant" | "size" | "className">) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState("")
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)
  const statusRef = useRef<HTMLParagraphElement>(null)

  const submit = async () => {
    setPending(true)
    setStatus("")
    setFailed(false)
    try {
      const res = await joinWaitlist({
        data: signedIn ? { item, source } : { item, source, email },
      })
      if ("error" in res) {
        setFailed(true)
        setStatus(res.error)
      } else {
        setDone(true)
        setStatus("You're on the list")
        setTimeout(() => statusRef.current?.focus(), 0)
      }
    } catch {
      setFailed(true)
      setStatus("Could not join the waitlist")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={cn("w-fit max-sm:w-full", buttonProps.className)}>
      {!done &&
        (signedIn || !open ? (
          <Button
            {...buttonProps}
            className="w-full"
            disabled={pending}
            onClick={signedIn ? submit : () => setOpen(true)}
          >
            {label}
          </Button>
        ) : (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <Label htmlFor={id} className="text-xs">
              Email
            </Label>
            <Input
              id={id}
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" className="w-full" disabled={pending}>
              Submit
            </Button>
          </form>
        ))}
      <p
        ref={statusRef}
        tabIndex={-1}
        aria-live="polite"
        className={cn(status ? "mt-2 text-xs outline-none" : "sr-only", failed ? "text-destructive" : "text-muted-foreground")}
      >
        {status}
      </p>
    </div>
  )
}
