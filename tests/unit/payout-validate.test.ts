import { test } from "node:test"
import assert from "node:assert/strict"
import {
  validatePayoutMethod, maskAccountNumber, maskPan, IFSC_RE, PAN_RE, VPA_RE,
} from "@/lib/payouts/validate"

test("accepts a valid bank method", () => {
  const e = validatePayoutMethod({
    method_type: "bank_account", account_name: "Alice",
    account_number: "12345678901", ifsc: "HDFC0001234", pan: "ABCDE1234F",
  })
  assert.deepEqual(e, {})
})
test("rejects bad IFSC, VPA, PAN", () => {
  assert.equal(IFSC_RE.test("hdfc0001234"), false)   // lower
  assert.equal(IFSC_RE.test("HDFC1001234"), false)   // 5th char not 0
  assert.equal(VPA_RE.test("alice"), false)          // no @
  assert.equal(PAN_RE.test("ABCDE12345"), false)     // last not letter
})
test("bank requires account fields; vpa requires vpa", () => {
  const b = validatePayoutMethod({ method_type: "bank_account", pan: "ABCDE1234F" })
  assert.ok(b.account_number && b.ifsc && b.account_name)
  const v = validatePayoutMethod({ method_type: "vpa", pan: "ABCDE1234F" })
  assert.ok(v.vpa)
})
test("pan always required", () => {
  const e = validatePayoutMethod({ method_type: "vpa", vpa: "alice@okhdfc", pan: "" })
  assert.ok(e.pan)
})
test("masks reveal only last 4", () => {
  assert.equal(maskAccountNumber("12345678901"), "•••••••8901")
  assert.equal(maskPan("ABCDE1234F"), "••••••234F")
})
