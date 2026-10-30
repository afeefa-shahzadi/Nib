// Parental consent for 13–17-year-olds. Server-only helpers (not "use server":
// these must never be callable from the browser directly).
import { createAdminClient } from "@/lib/supabase/server"
import { signEmailToken, verifyEmailToken } from "@/lib/email-tokens"
import { sendEmail } from "@/lib/email"
import { escapeHtml, nibButton } from "@/lib/email-layout"
import { MAX_CHILDREN_PER_PARENT } from "@/lib/consent-methods"

const RESEND_GAP_MS = 10 * 60_000

export const CONSENT_PENDING_MESSAGE =
  "Your account is waiting for a parent to approve it. You can read and follow writers now; publishing and posting open once they approve."

export async function consentStatus(userId: string): Promise<"not_required" | "pending" | "granted"> {
  const db = await createAdminClient()
  const { data } = await db.from("profiles").select("parental_consent").eq("id", userId).maybeSingle()
  return (data?.parental_consent as "not_required" | "pending" | "granted" | undefined) ?? "not_required"
}

// Call at the top of any action that publishes or posts publicly.
export async function assertCanPost(userId: string) {
  if ((await consentStatus(userId)) === "pending") throw new Error(CONSENT_PENDING_MESSAGE)
}

// Emails the parent a one-click approval link. Throttled so it can't be used to spam.
export async function sendParentalConsentEmail(userId: string): Promise<"sent" | "too_soon" | "not_pending" | "failed"> {
  const db = await createAdminClient()
  const { data: p } = await db
    .from("profiles")
    .select("display_name, handle, parent_email, parental_consent, parental_consent_sent_at")
    .eq("id", userId)
    .maybeSingle()
  if (!p || p.parental_consent !== "pending" || !p.parent_email) return "not_pending"
  if (p.parental_consent_sent_at && Date.now() - new Date(p.parental_consent_sent_at).getTime() < RESEND_GAP_MS)
    return "too_soon"

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const link = `${base}/parental-consent?u=${userId}&t=${signEmailToken("parental_consent", p.parent_email, userId)}`
  const name = escapeHtml(p.display_name || p.handle || "Your child")
  const sent = await sendEmail(
    p.parent_email,
    `${p.display_name || "Your child"} would like to join Nib`,
    `<p>${name} (@${escapeHtml(p.handle ?? "")}) signed up for Nib, a place to read and write, and gave this address as a parent's email.</p>
     <p>Because they're under 18, they can read but can't publish, comment or join debates until a parent approves.</p>
     ${nibButton("Review and approve", link, "info")}
     <p>If you don't know about this, ignore this email and the account stays read-only.</p>`
  )
  if (!sent.ok) return "failed"
  await db.from("profiles").update({ parental_consent_sent_at: new Date().toISOString() }).eq("id", userId)
  return "sent"
}

export async function verifyConsentLink(userId: string, token: string) {
  const db = await createAdminClient()
  const { data: p } = await db
    .from("profiles")
    .select("display_name, handle, parent_email, parental_consent")
    .eq("id", userId)
    .maybeSingle()
  if (!p?.parent_email || !verifyEmailToken("parental_consent", p.parent_email, userId, token)) return null
  return p as { display_name: string; handle: string; parent_email: string; parental_consent: string }
}

export type ConsentMethod = "email" | "digilocker" | "card"

// Records the approval and opens the account. One parent email can approve at
// most MAX_CHILDREN_PER_PARENT accounts, so a teen's spare inbox can't vouch for many.
export async function grantConsent(
  userId: string,
  token: string,
  opts: { method: ConsentMethod; declaredAdult: boolean; reference?: string | null; ip?: string | null; userAgent?: string | null }
): Promise<"granted" | "already"> {
  const p = await verifyConsentLink(userId, token)
  if (!p) throw new Error("This approval link isn't valid.")
  if (p.parental_consent !== "pending") return "already"
  if (!opts.declaredAdult) throw new Error("Confirm you're their parent or guardian and 18 or older.")
  const db = await createAdminClient()
  const { count } = await db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("parent_email", p.parent_email)
    .eq("parental_consent", "granted")
  if ((count ?? 0) >= MAX_CHILDREN_PER_PARENT)
    throw new Error(`This email has already approved ${MAX_CHILDREN_PER_PARENT} accounts. Contact us if you need more.`)
  await db.from("parental_consents").insert({
    user_id: userId,
    parent_email: p.parent_email,
    method: opts.method,
    declared_adult: true,
    reference: opts.reference ?? null,
    ip: opts.ip ?? null,
    user_agent: opts.userAgent?.slice(0, 300) ?? null,
  })
  await db
    .from("profiles")
    .update({ parental_consent: "granted", parental_consent_at: new Date().toISOString() })
    .eq("id", userId)
    .eq("parental_consent", "pending")
  return "granted"
}
