"use client"

import { CONTACT_EMAIL } from "@/lib/brand"
import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

export function ContactForm() {
  const searchParams = useSearchParams()
  const [intent, setIntent] = useState(searchParams?.get("intent") || "general")

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

      if (!res.ok) throw new Error("Could not submit form")
      
      setSuccess(true)
      toast.success("Message sent! Our team will reach out to you shortly.")
    } catch {
      toast.error(`Failed to send message. Please email us directly at ${CONTACT_EMAIL}`)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="surface-elevated mt-10 rounded-lg p-8 text-center">
        <h3 className="font-display text-2xl text-foreground">Message Received</h3>
        <p className="mt-2 text-muted-foreground">
          Thank you for your interest. A member of our team will be in touch with you shortly.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="surface-elevated mt-10 rounded-lg p-8 space-y-6">
      <div className="space-y-2">
        <Label htmlFor="intent">Topic *</Label>
        <Select value={intent} onValueChange={setIntent}>
          <SelectTrigger id="intent">
            <SelectValue placeholder="Select a topic" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General Inquiry</SelectItem>
            <SelectItem value="enterprise">Enterprise Sales</SelectItem>
            <SelectItem value="education">Education License</SelectItem>
            <SelectItem value="bug">Report a Bug</SelectItem>
            <SelectItem value="suggestion">Submit a Suggestion</SelectItem>
            <SelectItem value="partnership">Partnerships</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name *</Label>
          <Input id="fullName" name="fullName" required value={formData.fullName} onChange={handleChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{["enterprise", "education", "partnership"].includes(intent) ? "Work Email *" : "Email Address *"}</Label>
          <Input id="email" type="email" name="email" required value={formData.email} onChange={handleChange} />
        </div>
      </div>

      {["enterprise", "education", "partnership"].includes(intent) && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="organizationName">{intent === "education" ? "School / University Name *" : `Organization Name *`}</Label>
            <Input id="organizationName" name="organizationName" required value={formData.organizationName} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input id="phoneNumber" name="phoneNumber" type="tel" value={formData.phoneNumber} onChange={handleChange} />
          </div>
        </div>
      )}

      {(intent === "enterprise" || intent === "education") && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="expectedSeats">{intent === "education" ? "Expected Students / Faculty" : "Expected Users / Seats"}</Label>
            <Select onValueChange={(val) => setFormData(prev => ({...prev, expectedSeats: val}))}>
              <SelectTrigger id="expectedSeats">
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-50">1 - 50</SelectItem>
                <SelectItem value="51-200">51 - 200</SelectItem>
                <SelectItem value="201-1000">201 - 1,000</SelectItem>
                <SelectItem value="1000+">1,000+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timeline">Timeline to Buy</Label>
            <Select onValueChange={(val) => setFormData(prev => ({...prev, timeline: val}))}>
              <SelectTrigger id="timeline">
                <SelectValue placeholder="Select timeline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Immediately">Immediately</SelectItem>
                <SelectItem value="1-3 months">1 - 3 months</SelectItem>
                <SelectItem value="3-6 months">3 - 6 months</SelectItem>
                <SelectItem value="Exploring">Just exploring</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="details">How can we help? *</Label>
        <Textarea 
          id="details" 
          name="details" 
          rows={4} 
          required 
          value={formData.details} 
          onChange={handleChange}
          placeholder={intent === "enterprise" ? "Tell us about your organization's goals and required features..." : "Tell us what you need..."}
        />
      </div>

      <Button type="submit" size="lg" className="w-full md:w-auto" disabled={loading}>
        {loading ? "Sending..." : "Submit Request"}
      </Button>
    </form>
  )
}
