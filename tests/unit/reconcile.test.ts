import { test } from "node:test"
import assert from "node:assert/strict"
import { diffPayments } from "@/lib/reconcile"

const pay = (paymentId: string, orderId: string, amountPaise = 5000) => ({
  paymentId,
  orderId,
  amountPaise,
})

test("diffPayments: matched pair (paid purchase + one ledger row) -> no findings", () => {
  const findings = diffPayments([pay("pay_1", "order_1")], {
    purchasesByOrderId: new Map([["order_1", { status: "paid" }]]),
    ledgerCountByPaymentOrOrder: new Map([["order_1", 1]]),
  })
  assert.deepEqual(findings, [])
})

test("diffPayments: captured but purchase stuck 'created' -> MISSED_CREDIT", () => {
  const findings = diffPayments([pay("pay_1", "order_1")], {
    purchasesByOrderId: new Map([["order_1", { status: "created" }]]),
    ledgerCountByPaymentOrOrder: new Map(),
  })
  assert.equal(findings.length, 1)
  assert.equal(findings[0].type, "MISSED_CREDIT")
  assert.equal(findings[0].orderId, "order_1")
})

test("diffPayments: captured + settled purchase but no ledger row -> MISSING_LEDGER", () => {
  const findings = diffPayments([pay("pay_1", "order_1")], {
    purchasesByOrderId: new Map([["order_1", { status: "paid" }]]),
    ledgerCountByPaymentOrOrder: new Map(),
  })
  assert.equal(findings.length, 1)
  assert.equal(findings[0].type, "MISSING_LEDGER")
  assert.equal(findings[0].paymentId, "pay_1")
})

test("diffPayments: duplicate ledger rows for one payment -> DOUBLE_CREDIT", () => {
  // Keyed by payment id here to exercise the paymentId-first lookup.
  const findings = diffPayments([pay("pay_1", "order_1")], {
    purchasesByOrderId: new Map([["order_1", { status: "paid" }]]),
    ledgerCountByPaymentOrOrder: new Map([["pay_1", 2]]),
  })
  assert.equal(findings.length, 1)
  assert.equal(findings[0].type, "DOUBLE_CREDIT")
})

test("diffPayments: captured payment with no local purchase row is skipped", () => {
  // Subscription charges etc. also appear in /v1/payments — not drift.
  const findings = diffPayments([pay("pay_sub", "order_sub")], {
    purchasesByOrderId: new Map(),
    ledgerCountByPaymentOrOrder: new Map(),
  })
  assert.deepEqual(findings, [])
})
