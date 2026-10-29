"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { fileCounterNotice } from "@/actions/dmca"
import type { CounterNoticeInput } from "@/lib/dmca/validate"

export function CounterForm({ noticeId }: { noticeId: string }) {
  const [pending, start] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)

  const [statement, setStatement] = useState("")
  const [contact, setContact] = useState("")
  const [goodFaith, setGoodFaith] = useState(false)
  const [consent, setConsent] = useState(false)
  const [signature, setSignature] = useState("")

  if (done)
    return (
      <Card>
        <CardContent className="p-6 text-sm">
          Your counter-notice was received and forwarded. If the claimant does not pursue a
          court order, your content may be restored after the statutory period.
        </CardContent>
      </Card>
    )

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const input: CounterNoticeInput = {
      notice_id: noticeId,
      statement,
      consent_jurisdiction: consent,
      good_faith: goodFaith,
      signature,
      contact,
    }
    start(async () => {
      const res = await fileCounterNotice(input)
      if (res.success) {
        setErrors({})
        setDone(true)
      } else if (res.errors) {
        setErrors(res.errors)
        toast.error("Please correct the highlighted fields.")
      } else {
        toast.error(res.error ?? "Could not file your counter-notice.")
      }
    })
  }

  const err = (k: string) =>
    errors[k] && <p className="mt-1 text-xs text-destructive">{errors[k]}</p>

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <Label htmlFor="statement">Your statement</Label>
            <Textarea
              id="statement"
              required
              rows={4}
              className="mt-1"
              placeholder="Explain why the content was removed by mistake or misidentification."
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
            />
            {err("statement")}
          </div>

          <div>
            <Label htmlFor="contact">Your contact details (name, address, phone)</Label>
            <Textarea
              id="contact"
              required
              rows={2}
              className="mt-1"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
            {err("contact")}
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={goodFaith} onCheckedChange={(v) => setGoodFaith(v === true)} className="mt-0.5" />
            <span>
              Under penalty of perjury, I have a good-faith belief the content was removed by
              mistake or misidentification.{" "}
              {errors.good_faith && <span className="text-destructive">(required)</span>}
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
            <span>
              I consent to the jurisdiction of the appropriate court and will accept service of
              process from the claimant.{" "}
              {errors.consent_jurisdiction && <span className="text-destructive">(required)</span>}
            </span>
          </label>

          <div>
            <Label htmlFor="signature">Electronic signature (type your full name)</Label>
            <Input
              id="signature"
              required
              className="mt-1"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
            />
            {err("signature")}
          </div>

          <Button type="submit" disabled={pending}>
            {pending ? "Submitting…" : "Submit counter-notice"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
