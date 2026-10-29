import { test } from "node:test"
import assert from "node:assert/strict"
import { razorpayxConfigured, payoutModeFor } from "@/lib/razorpayx/client"

test("razorpayxConfigured false when any var missing", () => {
  delete process.env.RAZORPAYX_KEY_ID
  assert.equal(razorpayxConfigured(), false)
})
test("razorpayxConfigured true when all four set", () => {
  process.env.RAZORPAYX_KEY_ID = "k"
  process.env.RAZORPAYX_KEY_SECRET = "s"
  process.env.RAZORPAYX_ACCOUNT_NUMBER = "2323230000000000"
  process.env.RAZORPAYX_WEBHOOK_SECRET = "w"
  assert.equal(razorpayxConfigured(), true)
})
test("mode maps bank->IMPS, vpa->UPI", () => {
  assert.equal(payoutModeFor("bank_account"), "IMPS")
  assert.equal(payoutModeFor("vpa"), "UPI")
})
