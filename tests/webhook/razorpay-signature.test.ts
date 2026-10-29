import { test } from "node:test"
import assert from "node:assert/strict"
import { createHmac } from "crypto"
import { readFileSync } from "fs"
import { verifyRazorpaySignature } from "@/lib/razorpay/verify"

// Creds-free: we sign with our OWN known secret + body and prove the route's
// verification logic accepts the good one and rejects everything else. No real
// Razorpay keys involved — the HMAC is fully reproducible from the secret.
const SECRET = "whsec_test_known_secret_123"
const BODY = JSON.stringify({
  event: "payment.captured",
  payload: { payment: { entity: { id: "pay_TEST", order_id: "order_TEST", status: "captured" } } },
})
const sign = (body: string, secret: string) =>
  createHmac("sha256", secret).update(body).digest("hex")

test("correctly-signed payload passes", () => {
  const sig = sign(BODY, SECRET)
  assert.equal(verifyRazorpaySignature(BODY, sig, SECRET), true)
})

test("tampered body fails", () => {
  const sig = sign(BODY, SECRET) // signature for the original body
  const tampered = BODY.replace("pay_TEST", "pay_ATTACKER")
  assert.equal(verifyRazorpaySignature(tampered, sig, SECRET), false)
})

test("wrong signature fails", () => {
  assert.equal(verifyRazorpaySignature(BODY, sign(BODY, "wrong_secret"), SECRET), false)
  assert.equal(verifyRazorpaySignature(BODY, "deadbeef", SECRET), false)
  assert.equal(verifyRazorpaySignature(BODY, "", SECRET), false)
})

test("comparison is timing-safe (uses crypto.timingSafeEqual, not ===)", () => {
  // The route delegates to this helper; assert the helper's source actually
  // uses a constant-time compare rather than a plain === on the HMAC. A `===`
  // on a secret-derived digest is a real timing-oracle finding.
  const src = readFileSync(new URL("../../lib/razorpay/verify.ts", import.meta.url), "utf8")
  assert.match(src, /timingSafeEqual/, "verify helper must use crypto.timingSafeEqual")
  assert.doesNotMatch(
    src,
    /expected\s*===\s*signature|signature\s*===\s*expected/,
    "must not compare the HMAC with plain ==="
  )
})
