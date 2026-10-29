"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function ResetPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return toast.error(error.message)
    toast.success("Password updated.")
    router.push("/studio")
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="container-wide grid flex-1 place-items-center py-16">
        <div className="surface-elevated w-full max-w-sm rounded-lg p-8">
          <h1 className="font-display text-3xl text-foreground">
            Set a new password
          </h1>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="pw">New password</Label>
              <Input
                id="pw"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving…" : "Update password"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
