import { createHmac, timingSafeEqual } from "crypto"

/**
 * Verify a Razorpay webhook signature.
 *
 * Razorpay signs the raw request body with HMAC-SHA256 keyed on the webhook
 * secret and sends the hex digest in the `x-razorpay-signature` header. We
 * recompute it and compare in constant time so an attacker can't learn the
 * expected digest byte-by-byte via response timing.
 *
 * Pure and dependency-free (node:crypto only) so it can be unit-tested with a
 * known secret and no live keys.
 */
export function verifyRazorpaySignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  // Length check first: timingSafeEqual throws on mismatched lengths, and it's
  // safe to leak "wrong length" since the digest length is fixed and public.
  return a.length === b.length && timingSafeEqual(a, b)
}
