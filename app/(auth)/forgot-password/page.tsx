"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import Link from "next/link"

export default function ForgotPage() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) toast.error(error.message)
    else setSent(true)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="container-wide grid flex-1 place-items-center py-16">
        <div className="surface-elevated w-full max-w-sm rounded-lg p-8">
          <h1 className="font-display text-3xl text-foreground">
            Reset your password
          </h1>
          {sent ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Check your inbox for a reset link.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-foreground underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
