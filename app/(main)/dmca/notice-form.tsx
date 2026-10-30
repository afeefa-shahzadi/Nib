"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
  const g = noticeType === "grievance"
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
      <div className="rounded-lg border border-border p-8" role="status">
        <h2 className="font-display text-2xl">{g ? "Complaint received" : "Notice received"}</h2>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          Your reference is <code className="font-mono text-foreground">{done}</code>. A person
          reviews it before anything is changed.
        </p>
      </div>
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
    errors[k] && <p className="text-sm text-destructive">{errors[k]}</p>

  return (
    <div className="rounded-lg border border-border p-6 sm:p-8">
        <form onSubmit={onSubmit} className="space-y-6">
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

          <div className="space-y-2">
            <Label htmlFor="infringing_urls">Links to the content</Label>
            <Textarea
              id="infringing_urls"
              required
              rows={2}
              
              placeholder="One URL per line"
              value={infringingUrls}
              onChange={(e) => setInfringingUrls(e.target.value)}
            />
            {err("infringing_urls")}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content_object_id">
              Content ID <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="content_object_id"
              
              placeholder="We find the content from the links above"
              value={contentObjectId}
              onChange={(e) => setContentObjectId(e.target.value)}
            />
            {err("target_content_object_id")}
          </div>

          <div className="space-y-2">
            <Label htmlFor="work_identification">{g ? "What's wrong with it" : "The work you own"}</Label>
            <Textarea
              id="work_identification"
              required
              rows={2}
              
              value={workId}
              onChange={(e) => setWorkId(e.target.value)}
            />
            {err("work_identification")}
          </div>

          <div className="space-y-2">
            <Label htmlFor="complainant_name">Full legal name</Label>
            <Input
              id="complainant_name"
              required
              
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {err("complainant_name")}
          </div>

          <div className="space-y-2">
            <Label htmlFor="complainant_email">Email</Label>
            <Input
              id="complainant_email"
              type="email"
              required
              
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {err("complainant_email")}
          </div>

          <div className="space-y-2">
            <Label htmlFor="complainant_address">Postal address</Label>
            <Input
              id="complainant_address"
              required
              
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            {err("complainant_address")}
          </div>

          <div className="space-y-2">
            <Label htmlFor="complainant_role">You are</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "owner" | "agent")}>
              <SelectTrigger id="complainant_role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">{g ? "The person affected" : "The copyright owner"}</SelectItem>
                <SelectItem value="agent">{g ? "Acting for the person affected" : "Authorized to act for the owner"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-relaxed">
            <Checkbox checked={goodFaith} onCheckedChange={(v) => setGoodFaith(v === true)} className="mt-0.5" />
            <span>
              {g
                ? "I believe in good faith that this content breaks the law or Nib's rules."
                : "I believe in good faith that this use isn't authorized by the owner, their agent, or the law."}{" "}
              {errors.good_faith_statement && <span className="text-destructive">(required)</span>}
            </span>
          </label>

          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-relaxed">
            <Checkbox checked={accuracy} onCheckedChange={(v) => setAccuracy(v === true)} className="mt-0.5" />
            <span>
              {g
                ? "The information in this complaint is accurate."
                : "The information in this notice is accurate, and under penalty of perjury I am the owner or authorized to act for the owner."}{" "}
              {errors.accuracy_statement && <span className="text-destructive">(required)</span>}
            </span>
          </label>

          <div className="space-y-2">
            <Label htmlFor="signature">Signature <span className="font-normal text-muted-foreground">(type your full name)</span></Label>
            <Input
              id="signature"
              required
              
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
            />
            {err("signature")}
          </div>

          <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
            {pending ? "Sending…" : g ? "Send complaint" : "Send notice"}
          </Button>
        </form>
    </div>
  )
}
