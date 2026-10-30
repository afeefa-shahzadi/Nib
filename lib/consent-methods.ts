// Ways a parent can prove they're an adult before approving a 13–17 account.
// Email + declaration is always on. DigiLocker and the refunded ₹1 card check
// stay off during the free launch and until their credentials are configured.
import { isLaunchFree } from "@/lib/plan"
import { ageOn, ADULT_AGE } from "@/lib/age"

export const MAX_CHILDREN_PER_PARENT = 3
export const CARD_CHECK_PAISE = 100

export const digilockerEnabled = () =>
  !isLaunchFree() &&
  !!(process.env.DIGILOCKER_CLIENT_ID && process.env.DIGILOCKER_CLIENT_SECRET && process.env.DIGILOCKER_REDIRECT_URI)

export const cardCheckEnabled = () =>
  !isLaunchFree() && !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)

// DigiLocker returns the holder's date of birth as DDMMYYYY (sometimes DD/MM/YYYY or ISO).
export function parseDigilockerDob(raw: string | undefined | null): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.replace(/[/-]/g, "").match(/^(\d{2})(\d{2})(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

export function isAdultOn(dob: string | null, now = new Date()): boolean {
  const a = dob ? ageOn(dob, now) : null
  return a !== null && a >= ADULT_AGE
}

// ponytail: endpoint paths and token fields follow DigiLocker's public OAuth 2.0
// partner docs; confirm them against the partner sandbox when onboarding.
const DL_BASE = "https://digilocker.meripehchaan.gov.in/public/oauth2/1"

export function digilockerAuthorizeUrl(state: string) {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: process.env.DIGILOCKER_CLIENT_ID!,
    redirect_uri: process.env.DIGILOCKER_REDIRECT_URI!,
    state,
  })
  return `${DL_BASE}/authorize?${q}`
}

export async function digilockerDob(code: string): Promise<{ dob: string | null; reference: string | null }> {
  const res = await fetch(`${DL_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.DIGILOCKER_CLIENT_ID!,
      client_secret: process.env.DIGILOCKER_CLIENT_SECRET!,
      redirect_uri: process.env.DIGILOCKER_REDIRECT_URI!,
    }),
  })
  if (!res.ok) throw new Error(`DigiLocker ${res.status}`)
  const body = (await res.json()) as { dob?: string; digilockerid?: string }
  return { dob: parseDigilockerDob(body.dob), reference: body.digilockerid ?? null }
}
