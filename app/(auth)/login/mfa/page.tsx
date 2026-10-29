"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
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
    <div className="flex min-h-screen flex-col bg-background">
      <main className="container-wide grid flex-1 place-items-center py-16">
        <div className="surface-elevated w-full max-w-sm rounded-lg p-8">
          <h1 className="font-display text-3xl text-foreground">
            Two-factor authentication
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="mfa-code">Code</Label>
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
            <button type="button" onClick={signOut} className="text-foreground underline">
              Sign out
            </button>
          </p>
        </div>
      </main>
    </div>
  )
}
