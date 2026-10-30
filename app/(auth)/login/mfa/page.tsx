"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { AuthShell } from "@/components/auth/auth-shell"
import { safeRedirect } from "@/lib/safe-redirect"

// proxy.ts sends AAL1 sessions of users with a verified TOTP factor here.
export default function MfaPage() {
  return (
    <Suspense fallback={null}>
      <MfaChallenge />
    </Suspense>
  )
}

function MfaChallenge() {
  const raw = useSearchParams().get("redirect") || ""
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const { data, error: lErr } = await supabase.auth.mfa.listFactors()
    const factor = data?.totp.find((f) => f.status === "verified")
    if (lErr || !factor) {
      setLoading(false)
      toast.error("Couldn't load your authenticator. Sign in again.")
      return
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: code.trim(),
    })
    if (error) {
      setLoading(false)
      toast.error("That code didn't work. Check your authenticator app and try again.")
      return
    }
    // Full navigation so the proxy sees the upgraded (AAL2) session cookie.
    // Same-origin only — never bounce to another site after sign-in.
    window.location.replace(safeRedirect(raw, window.location.origin, "/studio"))
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.replace("/login")
  }

  return (
    <AuthShell title="Enter your sign-in code" intro="Open your authenticator app and type the 6-digit code for Nib.">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="mfa-code">6-digit code</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying…" : "Verify"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Can&apos;t get a code?{" "}
            <button type="button" onClick={signOut} className="inline-flex min-h-11 items-center font-medium text-primary hover:underline hover:underline-offset-4 lg:min-h-0">
              Sign out
            </button>
          </p>
    </AuthShell>
  )
}
