"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { PasswordInput } from "@/components/auth/password-input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { AuthShell } from "@/components/auth/auth-shell"

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
    <AuthShell title="Choose a new password" intro="Pick something you haven't used here before.">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pw">New password</Label>
              <PasswordInput id="pw" isNew value={password} onChange={setPassword} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving…" : "Update password"}
            </Button>
          </form>
    </AuthShell>
  )
}
