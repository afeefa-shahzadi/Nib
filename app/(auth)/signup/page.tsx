"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  RoleStep,
  RoleBadge,
  type AccountRole,
} from "@/components/auth/role-step"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import Link from "next/link"

function SignupPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams?.get("redirect")
  
  const initialRoleParam = searchParams?.get("role")
  const validRoles: AccountRole[] = ["reader", "creator", "organization"]
  const initialRole = validRoles.includes(initialRoleParam as AccountRole) ? (initialRoleParam as AccountRole) : null
  
  const [role, setRole] = useState<AccountRole | null>(initialRole)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [orgType, setOrgType] = useState("educational_institution")
  const [otherOrgType, setOtherOrgType] = useState("")
  const [dob, setDob] = useState("")
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [sent, setSent] = useState(false)

  // Age in whole years from a YYYY-MM-DD string, or null if unparseable.
  const ageFromDob = (d: string): number | null => {
    if (!d) return null
    const b = new Date(d)
    if (Number.isNaN(b.getTime())) return null
    const now = new Date()
    let age = now.getFullYear() - b.getFullYear()
    const m = now.getMonth() - b.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
    return age
  }

  const destination = redirect || (role === "reader" ? "/feed" : "/studio")

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user) router.replace(destination)
    })
    return () => data.subscription.unsubscribe()
  }, [router, destination])

  const onSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!role) return
    if (!agreed) {
      toast.error("Please accept the Terms and Privacy Policy to continue.")
      return
    }
    const age = ageFromDob(dob)
    if (age === null) {
      toast.error("Please enter your date of birth.")
      return
    }
    if (age < 13) {
      toast.error("You must be at least 13 years old to sign up.")
      return
    }
    setLoading(true)
    const base = email.split("@")[0]
    const cleanHandle = base.replace(/[^a-z0-9_]/gi, "").toLowerCase() + Math.floor(Math.random() * 10000)

    // date_of_birth flows into the profile via the handle_new_user trigger,
    // which casts raw_user_meta_data->>'date_of_birth' to DATE. It gates NSFW
    // (18+) downstream; without it the age check can never pass.
    const metaData: Record<string, string> = { display_name: base, handle: cleanHandle, role, date_of_birth: dob }
    if (role === "organization") {
      metaData.org_name = base
      metaData.org_type = orgType === "other" ? otherOrgType : orgType
    }
    
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: metaData,
      },
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    // With email confirmation on, signUp returns a user but no session. Tell the
    // user to confirm before they can sign in. (If confirmation is off, a session
    // exists and onAuthStateChange redirects — the sent screen is skipped.)
    if (signUpData.session) {
      toast.success("Account created. Welcome.")
    } else {
      setSent(true)
    }
  }

  const google = async () => {
    if (!agreed) {
      toast.error("Please accept the Terms and Privacy Policy to continue.")
      return
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    })
    if (error) toast.error("Google sign-in failed.")
  }

  const isAuthor = role === "creator"
  const isOrg = role === "organization"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="container-wide grid flex-1 place-items-center py-16">
        <div className="surface-elevated w-full max-w-sm rounded-lg p-8">
          {sent ? (
            <div className="text-center">
              <h1 className="font-display text-2xl text-foreground">Confirm your email</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                We sent a confirmation link to <span className="text-foreground">{email}</span>.
                Click it to activate your account, then sign in.
              </p>
              <Link href="/login" className="mt-6 inline-block text-sm text-foreground underline">
                Go to sign in
              </Link>
            </div>
          ) : !role ? (
            <RoleStep mode="signup" onSelect={setRole} />
          ) : (
            <>
              <RoleBadge role={role} onChange={() => setRole(null)} />
              <h1 className="font-display text-3xl text-foreground">
                {isOrg ? "Create your organization" : isAuthor ? "Start your studio" : "Create your account"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {isOrg
                  ? "Set up your workspace and invite members."
                  : isAuthor
                  ? "It's free to write and publish."
                  : "Follow authors and shape the discourse."}
              </p>

              <label className="mt-6 flex items-start gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0"
                />
                <span>
                  I agree to the{" "}
                  <Link href="/terms" target="_blank" className="text-foreground underline">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" target="_blank" className="text-foreground underline">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>

              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full"
                onClick={google}
                disabled={!agreed}
              >
                Continue with Google
              </Button>
              <div className="my-5 flex items-center gap-3 text-xs tracking-wider text-muted-foreground uppercase">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                {isOrg && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="orgType">Organization Type</Label>
                      <Select
                        value={orgType}
                        onValueChange={(val) => setOrgType(val)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="educational_institution">Educational Institution</SelectItem>
                          <SelectItem value="business">Business</SelectItem>
                          <SelectItem value="non_profit">Non-Profit</SelectItem>
                          <SelectItem value="government">Government</SelectItem>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {orgType === "other" && (
                      <div>
                        <Label htmlFor="otherOrgType">Please specify</Label>
                        <Input
                          id="otherOrgType"
                          required
                          value={otherOrgType}
                          onChange={(e) => setOtherOrgType(e.target.value)}
                          className="mt-1"
                          placeholder="e.g. Research Lab"
                        />
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <Label htmlFor="dob">Date of birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    required
                    value={dob}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDob(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Used to confirm you meet the minimum age and to gate mature content.
                  </p>
                </div>
                <div>
                  <Label htmlFor="em">Email</Label>
                  <Input
                    id="em"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="pw">Password</Label>
                  <Input
                    id="pw"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || !agreed}>
                  {loading ? "Creating…" : "Create account"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already here?{" "}
                <Link href="/login" className="text-foreground underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SignupPageContent />
    </Suspense>
  )
}
