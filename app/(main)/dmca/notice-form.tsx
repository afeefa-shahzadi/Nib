"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fileDmcaNotice } from "@/actions/dmca"
import type { NoticeInput } from "@/lib/dmca/validate"

export function NoticeForm({ noticeType }: { noticeType: "dmca" | "grievance" }) {
  const [pending, start] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState<string | null>(null)

  const [infringingUrls, setInfringingUrls] = useState("")
  const [contentObjectId, setContentObjectId] = useState("")
  const [workId, setWorkId] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [role, setRole] = useState<"owner" | "agent">("owner")
  const [goodFaith, setGoodFaith] = useState(false)
  const [accuracy, setAccuracy] = useState(false)
  const [signature, setSignature] = useState("")
  const [website, setWebsite] = useState("") // honeypot

  if (done)
    return (
      <Card>
        <CardContent className="p-6 text-sm">
          Your notice was received. Reference: <code>{done}</code>. We review every notice
          before any action is taken.
        </CardContent>
      </Card>
    )

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const input: NoticeInput & { website?: string } = {
      notice_type: noticeType,
      target_content_object_id: contentObjectId,
      complainant_name: name,
      complainant_email: email,
      complainant_address: address,
      complainant_role: role,
      work_identification: workId,
      infringing_urls: infringingUrls
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      good_faith_statement: goodFaith,
      accuracy_statement: accuracy,
      signature,
      website,
    }
    start(async () => {
      const res = await fileDmcaNotice(input)
      if (res.success) {
        setErrors({})
        setDone(res.reference ?? "received")
      } else if (res.errors) {
        setErrors(res.errors)
        toast.error("Please correct the highlighted fields.")
      } else {
        toast.error(res.error ?? "Could not file your notice.")
      }
    })
  }

  const err = (k: string) =>
    errors[k] && <p className="mt-1 text-xs text-destructive">{errors[k]}</p>

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-5">
          {/* honeypot: visually hidden, bots fill it */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />

          <div>
            <Label htmlFor="infringing_urls">Content URL(s) being reported</Label>
            <Textarea
              id="infringing_urls"
              required
              rows={2}
              className="mt-1"
              placeholder="One URL per line"
              value={infringingUrls}
              onChange={(e) => setInfringingUrls(e.target.value)}
            />
            {err("infringing_urls")}
          </div>

          <div>
            <Label htmlFor="content_object_id">
              Content ID <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="content_object_id"
              className="mt-1"
              placeholder="Leave blank — we identify the content from the URL above"
              value={contentObjectId}
              onChange={(e) => setContentObjectId(e.target.value)}
            />
            {err("target_content_object_id")}
          </div>

          <div>
            <Label htmlFor="work_identification">The copyrighted work you own</Label>
            <Textarea
              id="work_identification"
              required
              rows={2}
              className="mt-1"
              value={workId}
              onChange={(e) => setWorkId(e.target.value)}
            />
            {err("work_identification")}
          </div>

          <div>
            <Label htmlFor="complainant_name">Your full legal name</Label>
            <Input
              id="complainant_name"
              required
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {err("complainant_name")}
          </div>

          <div>
            <Label htmlFor="complainant_email">Contact email</Label>
            <Input
              id="complainant_email"
              type="email"
              required
              className="mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {err("complainant_email")}
          </div>

          <div>
            <Label htmlFor="complainant_address">Contact mailing address</Label>
            <Input
              id="complainant_address"
              required
              className="mt-1"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            {err("complainant_address")}
          </div>

          <div>
            <Label htmlFor="complainant_role">You are the</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "owner" | "agent")}>
              <SelectTrigger id="complainant_role" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">copyright owner</SelectItem>
                <SelectItem value="agent">authorized agent of the owner</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={goodFaith} onCheckedChange={(v) => setGoodFaith(v === true)} className="mt-0.5" />
            <span>
              I have a good-faith belief that the use is not authorized by the owner, its
              agent, or the law.{" "}
              {errors.good_faith_statement && <span className="text-destructive">(required)</span>}
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={accuracy} onCheckedChange={(v) => setAccuracy(v === true)} className="mt-0.5" />
            <span>
              The information in this notice is accurate, and under penalty of perjury I am
              the owner or authorized to act for the owner.{" "}
              {errors.accuracy_statement && <span className="text-destructive">(required)</span>}
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
            {pending ? "Submitting…" : "Submit notice"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
