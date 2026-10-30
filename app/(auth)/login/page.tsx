"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthShell, FieldError } from "@/components/auth/auth-shell"
import { PasswordInput } from "@/components/auth/password-input"
import { toast } from "sonner"
import { safeRedirect } from "@/lib/safe-redirect"

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginPageContent />
    </Suspense>
  )
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = safeRedirect(searchParams.get("redirect") || "", undefined, "")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const supabase = createClient()
  // Land where the account belongs: readers in the feed, authors and orgs in the studio.
  const destinationFor = (meta?: { role?: string }) => redirect || (meta?.role === "reader" ? "/feed" : "/studio")

  const linkError = searchParams.get("error") === "link"
  useEffect(() => {
    if (linkError) toast.error("That sign-in link is invalid or has expired. Sign in below or request a new one.")
  }, [linkError])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user) router.replace(destinationFor(s.user.user_metadata))
    })
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(destinationFor(user.user_metadata))
    })
    return () => data.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirect, router, supabase.auth])

  const onSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error)
      setError(
        error.message === "Invalid login credentials"
          ? "That email and password don't match. Check them, or reset your password."
          : error.message
      )
  }

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    })
    if (error) toast.error("Google sign-in didn't work. Try again, or use your email.")
  }

  return (
    <AuthShell
      title="Welcome back"
      intro="Sign in to read, write and pick up where you left off."
      aside={
        <>
          New to Nib?{" "}
          <Link href="/signup" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline hover:underline-offset-4 lg:min-h-0">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
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

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="-my-2 inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground lg:min-h-8"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="password" value={password} onChange={setPassword} invalid={!!error} describedBy={error ? "login-error" : undefined} />
          <FieldError id="login-error">{error}</FieldError>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  )
}
