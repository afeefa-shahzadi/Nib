import { createHmac, timingSafeEqual } from "crypto"

// Stateless signed tokens for unsubscribe / confirm links. HMAC(email+author+
// purpose) keyed on a server secret means the link is unforgeable without a
// per-row token column: the link carries (email, author, token) and we recompute
// and compare. Purpose-scoping stops an unsubscribe token being replayed as a
// confirm token or vice-versa.

type Purpose = "unsubscribe" | "confirm" | "parental_consent"

function secret(): string {
  const s = process.env.EMAIL_TOKEN_SECRET || process.env.SUPABASE_SECRET_KEY
  if (!s)
    throw new Error(
      "EMAIL_TOKEN_SECRET or SUPABASE_SECRET_KEY must be set to sign email links"
    )
  return s
}

export function signEmailToken(
  purpose: Purpose,
  email: string,
  authorId: string
): string {
  return createHmac("sha256", secret())
    .update(`${purpose}:${email.trim().toLowerCase()}:${authorId}`)
    .digest("base64url")
}

export function verifyEmailToken(
  purpose: Purpose,
  email: string,
  authorId: string,
  token: string
): boolean {
  const expected = signEmailToken(purpose, email, authorId)
  const a = Buffer.from(expected)
  const b = Buffer.from(token)
  // Constant-time compare; bail on length mismatch (timingSafeEqual throws then).
  return a.length === b.length && timingSafeEqual(a, b)
}
