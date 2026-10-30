"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RolePicker, type AccountRole } from "@/components/auth/role-step"
import { AuthShell, FieldError } from "@/components/auth/auth-shell"
import { PasswordInput } from "@/components/auth/password-input"
import { resendParentalConsent } from "@/actions/parental-consent"
import { ageOn, MIN_AGE, needsParentalConsent } from "@/lib/age"
import { toast } from "sonner"

const COPY: Record<AccountRole, { title: string; intro: string; points: string[] }> = {
  reader: {
    title: "Create your account",
    intro: "Follow writers, read the way you like, and join the conversation.",
    points: ["Pieces that adapt to how you read", "Highlights, notes and debates", "Free to read"],
  },
  creator: {
    title: "Start your studio",
    intro: "Free to write and publish. Every feature is free during launch.",
    points: ["Pieces that adapt to each reader", "Keep 93–100% of what readers pay", "Export everything, any time"],
  },
  organization: {
    title: "Create your organization",
    intro: "A shared workspace for schools, newsrooms, labs and teams.",
    points: ["One workspace, many writers", "Members-only pieces and debates", "Roles for owners, admins and members"],
  },
}

const ORG_TYPES = [
  ["educational_institution", "School, college or university"],
  ["business", "Business"],
  ["non_profit", "Non-profit"],
  ["government", "Government"],
  ["standard", "Standard"],
  ["other", "Other"],
] as const

type Errors = Partial<Record<"dob" | "parent" | "agreed" | "form", string>>

function SignupPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams?.get("redirect")
  const roleParam = searchParams?.get("role") as AccountRole | null
  const [role, setRole] = useState<AccountRole>(
    roleParam && roleParam in COPY ? roleParam : "creator"
  )
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [orgType, setOrgType] = useState("educational_institution")
  const [otherOrgType, setOtherOrgType] = useState("")
  const [dob, setDob] = useState("")
  const [parentEmail, setParentEmail] = useState("")
  const [agreed, setAgreed] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [resending, setResending] = useState(false)

  const minor = needsParentalConsent(dob)
  const destination = redirect || (role === "reader" ? "/feed" : "/studio")

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user) router.replace(destination)
    })
    return () => data.subscription.unsubscribe()
  }, [router, destination])

  const onSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    const age = ageOn(dob)
    const next: Errors = {}
    if (age === null) next.dob = "Enter your date of birth."
    else if (age < MIN_AGE) next.dob = `You need to be at least ${MIN_AGE} to join Nib.`
    if (minor && !/^\S+@\S+\.\S+$/.test(parentEmail)) next.parent = "Enter a parent's email address."
    else if (minor && parentEmail.trim().toLowerCase() === email.trim().toLowerCase())
      next.parent = "Use a parent's own email, not yours."
    if (!agreed) next.agreed = "Accept the Terms and Privacy Policy to continue."
    setErrors(next)
    if (Object.keys(next).length) return

    setLoading(true)
    const base = email.split("@")[0]
    const handle = base.replace(/[^a-z0-9_]/gi, "").toLowerCase() + Math.floor(Math.random() * 10000)
    // date_of_birth and parent_email flow into the profile via the handle_new_user trigger.
    const meta: Record<string, string> = { display_name: base, handle, role, date_of_birth: dob }
    if (minor) meta.parent_email = parentEmail.trim()
    if (role === "organization") {
      meta.org_name = base
      meta.org_type = orgType === "other" ? otherOrgType : orgType
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm`, data: meta },
    })
    setLoading(false)
    if (error) return setErrors({ form: error.message })
    if (data.session) {
      // No email confirmation step: ask the parent now instead of on confirm.
      if (minor) await resendParentalConsent().catch(() => {})
      toast.success("Account created. Welcome.")
    } else setSent(true)
  }

  const resend = async () => {
    setResending(true)
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    })
    setResending(false)
    if (error) toast.error(error.message)
    else toast.success("Sent again. Check your inbox and spam folder.")
  }

  const google = async () => {
    if (!agreed) return setErrors({ agreed: "Accept the Terms and Privacy Policy to continue." })
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    })
    if (error) toast.error("Google sign-in didn't work. Try again, or use your email.")
  }

  const copy = COPY[role]
  const signIn = (
    <>
      Already have an account?{" "}
      <Link href="/login" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline hover:underline-offset-4 lg:min-h-0">
        Sign in
      </Link>
    </>
  )

  if (sent)
    return (
      <AuthShell title="Check your email" intro={<>We sent a link to <span className="text-foreground">{email}</span>. Open it to activate your account.</>} aside={signIn}>
        <h2 className="font-display text-2xl">Didn&apos;t get it?</h2>
        <p className="mt-2 text-muted-foreground">
          It can take a minute. Check spam, or send it again.
          {minor && " Once you confirm, we'll email your parent to approve your account."}
        </p>
        <Button className="mt-6 w-full" variant="outline" onClick={resend} disabled={resending}>
          {resending ? "Sending…" : "Send the link again"}
        </Button>
        <Button className="mt-3 w-full" variant="ghost" onClick={() => setSent(false)}>
          Use a different email
        </Button>
      </AuthShell>
    )

  return (
    <AuthShell title={copy.title} intro={copy.intro} points={copy.points} aside={signIn}>
      <form onSubmit={onSubmit} className="space-y-5">
        <RolePicker value={role} onChange={setRole} label="I'm joining as" />

        {process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1" && (
          <>
            <Button type="button" variant="outline" className="w-full" onClick={google}>
              Continue with Google
            </Button>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        {role === "organization" && (
          <div className="space-y-2">
            <Label htmlFor="orgType">Organization type</Label>
            <Select value={orgType} onValueChange={setOrgType}>
              <SelectTrigger id="orgType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORG_TYPES.map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {orgType === "other" && (
              <Input
                aria-label="Type of organization"
                required
                value={otherOrgType}
                onChange={(e) => setOtherOrgType(e.target.value)}
                placeholder="Research lab"
              />
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="em">Email</Label>
          <Input id="em" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw">Password</Label>
          <PasswordInput id="pw" isNew value={password} onChange={setPassword} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dob">Date of birth</Label>
          <DatePicker id="dob" value={dob} onChange={setDob} min={new Date(1900, 0, 1)} max={new Date()} placeholder="Pick your date of birth" />
          {errors.dob ? (
            <FieldError id="dob-error">{errors.dob}</FieldError>
          ) : (
            <p className="text-sm text-muted-foreground">Under 18? We&apos;ll ask a parent to approve your account.</p>
          )}
        </div>

        {minor && (
          <div className="space-y-2 rounded-md bg-muted/50 p-4">
            <Label htmlFor="parent">Parent&apos;s email</Label>
            <Input
              id="parent"
              type="email"
              required
              autoComplete="off"
              placeholder="parent@example.com"
              aria-invalid={!!errors.parent || undefined}
              aria-describedby="parent-help"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
            />
            <FieldError id="parent-error">{errors.parent}</FieldError>
            <p id="parent-help" className="text-sm text-muted-foreground">
              We&apos;ll email them a link to approve. Until they do, you can read and follow writers, but not publish or post.
            </p>
          </div>
        )}

        <div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
            <Checkbox aria-label="I agree to the Terms and Privacy Policy" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" aria-describedby={errors.agreed ? "agreed-error" : undefined} />
            <span className="text-muted-foreground">
              I agree to the{" "}
              <Link href="/terms" target="_blank" className="text-foreground underline underline-offset-4">Terms</Link> and{" "}
              <Link href="/privacy" target="_blank" className="text-foreground underline underline-offset-4">Privacy Policy</Link>.
            </span>
          </label>
          <FieldError id="agreed-error">{errors.agreed}</FieldError>
        </div>

        <FieldError id="form-error">{errors.form}</FieldError>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating your account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SignupPageContent />
    </Suspense>
  )
}
