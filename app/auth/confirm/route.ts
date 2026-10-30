import { NextResponse, type NextRequest } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { sendParentalConsentEmail } from "@/lib/parental-consent"

// Landing point for email links (sign-up confirm, magic link, invite, recovery).
// token_hash works on any device; code (PKCE) only in the browser that asked.
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const tokenHash = url.searchParams.get("token_hash")
  const type = url.searchParams.get("type") as EmailOtpType | null
  const code = url.searchParams.get("code")
  const next = url.searchParams.get("next")
  const dest = next?.startsWith("/") && !next.startsWith("//") ? next : "/feed"

  const supabase = await createClient()
  const { error } = tokenHash && type
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    : code
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: new Error("missing token") }

  if (error) {
    const login = new URL("/login", url)
    login.searchParams.set("error", "link")
    return NextResponse.redirect(login)
  }
  // A confirmed under-18 account: now that the email is real, ask the parent.
  if (type !== "recovery") {
    const { data } = await supabase.auth.getUser()
    if (data.user) await sendParentalConsentEmail(data.user.id).catch((e) => console.error("[consent]", e))
  }
  return NextResponse.redirect(new URL(type === "recovery" ? "/reset-password" : dest, url))
}
