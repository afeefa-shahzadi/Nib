"use server"
import { headers } from "next/headers"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { consentStatus, sendParentalConsentEmail, verifyConsentLink } from "@/lib/parental-consent"

export async function getMyConsentStatus() {
  const { data } = await (await createClient()).auth.getUser()
  return data.user ? consentStatus(data.user.id) : "not_required"
}

export async function resendParentalConsent() {
  const { data } = await (await createClient()).auth.getUser()
  if (!data.user) throw new Error("Sign in first.")
  const r = await sendParentalConsentEmail(data.user.id)
  if (r === "failed") throw new Error("We couldn't send the email just now. Try again in a few minutes.")
  if (r === "too_soon") throw new Error("We sent one a few minutes ago. Check your parent's inbox, or try again in 10 minutes.")
  return r
}

// Called from the emailed link's page. The link's HMAC proves it came from that email.
export async function grantParentalConsent(userId: string, token: string) {
  const p = await verifyConsentLink(userId, token)
  if (!p) throw new Error("This approval link isn't valid.")
  if (p.parental_consent !== "pending") return "already"
  const db = await createAdminClient()
  const h = await headers()
  await db.from("parental_consents").insert({
    user_id: userId,
    parent_email: p.parent_email,
    ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
    user_agent: h.get("user-agent")?.slice(0, 300) ?? null,
  })
  await db
    .from("profiles")
    .update({ parental_consent: "granted", parental_consent_at: new Date().toISOString() })
    .eq("id", userId)
    .eq("parental_consent", "pending")
  return "granted"
}
