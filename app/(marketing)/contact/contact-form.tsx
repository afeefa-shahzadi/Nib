"use client"

import { CONTACT_EMAIL } from "@/lib/brand"
import { CONTACT_TOPICS, ORG_TOPICS, type ContactTopic } from "@/lib/contact"
import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { CircleCheck } from "lucide-react"
import { toast } from "sonner"

const Optional = () => <span className="font-normal text-muted-foreground"> (optional)</span>

export function ContactForm() {
  const searchParams = useSearchParams()
  const fromUrl = searchParams?.get("intent") ?? ""
  const [intent, setIntent] = useState<ContactTopic>(fromUrl in CONTACT_TOPICS ? (fromUrl as ContactTopic) : "general")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    organizationName: "",
    phoneNumber: "",
    expectedSeats: "",
    timeline: "",
    details: "",
  })

  const isOrg = ORG_TOPICS.includes(intent)
  const isSales = intent === "enterprise" || intent === "education"

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, intent }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "" }))
        throw new Error(error || `Couldn't send your message. Email us at ${CONTACT_EMAIL}.`)
      }
      setSuccess(true)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-border p-8" role="status">
        <CircleCheck className="size-6 text-primary" aria-hidden />
        <h2 className="mt-4 font-display text-2xl">Message sent</h2>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          Thanks, {formData.fullName.split(" ")[0]}. We&apos;ll reply to {formData.email}.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-border p-6 sm:p-8">
      <div className="space-y-2">
        <Label htmlFor="intent">Topic</Label>
        <Select value={intent} onValueChange={(v) => setIntent(v as ContactTopic)}>
          <SelectTrigger id="intent" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CONTACT_TOPICS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Name</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required value={formData.fullName} onChange={handleChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{isOrg ? "Work email" : "Email"}</Label>
          <Input id="email" type="email" name="email" autoComplete="email" required value={formData.email} onChange={handleChange} />
        </div>
      </div>

      {isOrg && (
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="organizationName">{intent === "education" ? "School or university" : "Organization"}</Label>
            <Input id="organizationName" name="organizationName" autoComplete="organization" required value={formData.organizationName} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone<Optional /></Label>
            <Input id="phoneNumber" name="phoneNumber" type="tel" autoComplete="tel" value={formData.phoneNumber} onChange={handleChange} />
          </div>
        </div>
      )}

      {isSales && (
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="expectedSeats">{intent === "education" ? "Students and staff" : "Team size"}<Optional /></Label>
            <Select onValueChange={(val) => setFormData((prev) => ({ ...prev, expectedSeats: val }))}>
              <SelectTrigger id="expectedSeats" className="w-full">
                <SelectValue placeholder="Choose a size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-50">1–50</SelectItem>
                <SelectItem value="51-200">51–200</SelectItem>
                <SelectItem value="201-1000">201–1,000</SelectItem>
                <SelectItem value="1000+">More than 1,000</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timeline">When do you want to start?<Optional /></Label>
            <Select onValueChange={(val) => setFormData((prev) => ({ ...prev, timeline: val }))}>
              <SelectTrigger id="timeline" className="w-full">
                <SelectValue placeholder="Choose a time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Immediately">Right away</SelectItem>
                <SelectItem value="1-3 months">In 1–3 months</SelectItem>
                <SelectItem value="3-6 months">In 3–6 months</SelectItem>
                <SelectItem value="Exploring">Just exploring</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="details">Message</Label>
        <Textarea
          id="details"
          name="details"
          rows={6}
          required
          maxLength={5000}
          value={formData.details}
          onChange={handleChange}
          placeholder={
            intent === "bug"
              ? "What happened, what you expected, and the page you were on."
              : isSales
                ? "What your team wants to do with Nib."
                : "How can we help?"
          }
        />
      </div>

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={loading}>
        {loading ? <Spinner /> : "Send message"}
      </Button>
    </form>
  )
}
