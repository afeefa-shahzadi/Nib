"use server"
import { createServiceRoleClient, createClient } from "@/lib/supabase/server"
import { generateText } from "ai"
import { createMistral } from "@ai-sdk/mistral"
import { hasStudioAccess } from "@/lib/plan"
import { checkRateLimit } from "@/lib/rate-limit.server"

const VALID_TYPES = ["visual", "cognitive", "hearing", "motor"] as const

// The uploaded images must be signed URLs from our own `verifications` bucket,
// scoped to the caller's own storage folder (`<userId>/...`). This blocks
// passing arbitrary external URLs to the vision model and ties the evidence to
// the user who is claiming the impairment.
function isOwnVerificationUrl(rawUrl: string, userId: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return false
  let u: URL, b: URL
  try {
    u = new URL(rawUrl)
    b = new URL(base)
  } catch {
    return false
  }
  if (u.origin !== b.origin) return false
  return u.pathname.includes(`/verifications/${userId}/`)
}

// Parked (park/paid-features): AI auto-approval of medical flags is off for
// launch. Flip to true only when the verification flow is rebuilt.
const VERIFICATION_ENABLED = false

export async function verifyDisabilityDocuments(args: {
  documentUrl: string
  photoUrl: string
  type: "visual" | "cognitive" | "hearing" | "motor"
}) {
  if (!VERIFICATION_ENABLED)
    return { error: "Verification is not available right now." }
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()

  if (!user) throw new Error("Unauthorized")

  if (!VALID_TYPES.includes(args.type)) {
    return { success: false, error: "Invalid impairment type." }
  }
  if (
    !isOwnVerificationUrl(args.documentUrl, user.id) ||
    !isOwnVerificationUrl(args.photoUrl, user.id)
  ) {
    return { success: false, error: "Invalid document references." }
  }
  // Cap attempts: this flips a persistent paid-feature entitlement, so it must
  // not be brute-forceable against the AI check. 5 attempts per day.
  const rl = await checkRateLimit(
    "disability_verify",
    user.id,
    5,
    86400
  )
  if (!rl.ok) {
    return {
      success: false,
      error: "Too many verification attempts. Try again tomorrow.",
    }
  }

  // Use Mistral's pixtral model for vision
  const aiModel = createMistral({ apiKey: process.env.MISTRAL_API_KEY })("pixtral-large-latest")

  try {
    const { text } = await generateText({
      model: aiModel,
      system: `You are an AI document verification assistant.
Your job is to verify whether the provided documents prove that the user has a ${args.type} impairment.
The user provides an original document (medical certificate, accessible parking permit, etc.) and a full picture of themselves.
Evaluate the documents.
Return ONLY a JSON object with two keys: "valid" (boolean) and "reason" (string explaining why). Do not include markdown formatting.`,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Verify these documents for ${args.type} impairment:` },
            { type: "image", image: args.documentUrl },
            { type: "image", image: args.photoUrl },
          ],
        },
      ],
    })

    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/g, "").trim()
    const result = JSON.parse(cleaned)

    if (result.valid) {
      const fieldName = `disability_${args.type}`
      // disability_* is a sensitive, service-role-only column under the profiles
      // column-grant model; writing it via the cookie client runs as
      // `authenticated` and is grant-denied, so the entitlement never persists.
      // Identity is verified above; do the write with the true service role.
      const db = await createServiceRoleClient()
      await db.from("profiles").update({
        [fieldName]: true
      }).eq("id", user.id)
    }

    return { success: true, valid: result.valid, reason: result.reason }
  } catch (error) {
    console.error("[server] AI Verification Error:", error)
    return { success: false, error: "Failed to process verification." }
  }
}

async function getMyDisabilityFlags() {
  const { data: _auth } = await (await createClient()).auth.getUser()
  if (!_auth?.user) return null

  // disability_* columns are service-role-only under the profiles
  // column-grant privacy model; identity comes from the cookie session,
  // the read runs service-role scoped to that verified id.
  const db = await createServiceRoleClient()
  const { data: profile } = await db
    .from("profiles")
    .select("plan, disability_visual, disability_cognitive, disability_hearing, disability_motor")
    .eq("id", _auth.user.id)
    .maybeSingle()

  return profile
}

export async function canUsePremiumVoice() {
  const flags = await getMyDisabilityFlags()
  if (!flags) return false
  return hasStudioAccess(flags.plan) || flags.disability_visual === true
}

export async function canUseAISummary() {
  const flags = await getMyDisabilityFlags()
  if (!flags) return false
  return hasStudioAccess(flags.plan) || flags.disability_cognitive === true
}

export async function canUseFreeDictation() {
  const flags = await getMyDisabilityFlags()
  if (!flags) return false
  return hasStudioAccess(flags.plan) || flags.disability_motor === true
}
