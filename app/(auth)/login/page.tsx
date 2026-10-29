"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  RoleStep,
  RoleBadge,
  type AccountRole,
} from "@/components/auth/role-step"
import { toast } from "sonner"
import { safeRedirect } from "@/lib/safe-redirect"

import { Suspense } from "react"

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
  const redirect = safeRedirect(
    searchParams.get("redirect") || "",
    undefined,
    ""
  )

  const [role, setRole] = useState<AccountRole | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const supabase = createClient()
  const destination = redirect || (role === "reader" ? "/feed" : "/studio")

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user) router.replace(destination)
    })
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(destination)
    })
    return () => data.subscription.unsubscribe()
  }, [destination, router, supabase.auth])

  const onSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)
    if (error) toast.error(error.message)
  }

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    })
    if (error) toast.error("Google sign-in failed.")
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="container-wide grid flex-1 place-items-center py-16">
        <div className="surface-elevated w-full max-w-sm rounded-lg p-8">
          {!role ? (
            <RoleStep mode="signin" onSelect={setRole} />
          ) : (
            <>
              <RoleBadge role={role} onChange={() => setRole(null)} />
              <h1 className="font-display text-3xl text-foreground">Sign in</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {role === "reader"
                  ? "We'll drop you into your feed."
                  : "We'll take you to the studio."}
              </p>

              {/* Hidden until the Google provider is enabled in Supabase Auth. */}

              {process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1" && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-6 w-full"
                    onClick={google}
                  >
                    Continue with Google
                  </Button>
                  <div className="my-5 flex items-center gap-3 text-xs tracking-wider text-muted-foreground uppercase">
                    <span className="h-px flex-1 bg-border" />
                    or
                    <span className="h-px flex-1 bg-border" />
                  </div>
                </>
              )}

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      href="/forgot-password"
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Forgot?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                No account?{" "}
                <Link href="/signup" className="text-foreground underline">
                  Create one
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
